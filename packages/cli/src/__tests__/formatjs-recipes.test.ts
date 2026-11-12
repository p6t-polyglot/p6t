import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createIntl, defineMessages } from "@formatjs/intl";

const require = createRequire(import.meta.url);
const formatjs = path.join(path.dirname(require.resolve("@formatjs/cli/package.json")), "bin/formatjs");
const scripts = new URL("../../../../skills/integrate-p6t/scripts/", import.meta.url);
const nodeModules = new URL("../../node_modules/", import.meta.url);
type Catalog = Record<string, { defaultMessage: string; description?: string }>;

describe("bundled FormatJS recipes", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "p6t-formatjs-"));
    for (const name of ["generate-ids.mjs", "check-catalogs.mjs"]) {
      fs.copyFileSync(new URL(name, scripts), path.join(dir, name));
    }
    fs.symlinkSync(nodeModules, path.join(dir, "node_modules"), "dir");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function run(script: string, ...args: string[]) {
    return spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: "utf8" });
  }

  function write(name: string, data: unknown) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(data));
  }

  function read<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as T;
  }

  it("extracts distinct IDs for identical text with different descriptions and resolves them without React or a transform", () => {
    fs.writeFileSync(path.join(dir, "messages.ts"), `
      import { defineMessages } from '@formatjs/intl'
      export const messages = defineMessages({
        action: { defaultMessage: 'Open', description: 'Opens the project' },
        status: { defaultMessage: 'Open', description: 'Unresolved ticket status' },
        sameAction: { defaultMessage: 'Open', description: 'Opens the project' },
      })
    `);
    const extract = run(formatjs, "extract", "messages.ts", "--out-file", "en.json", "--id-interpolation-pattern", "[sha512:contenthash:base64:6]", "--extract-source-location", "--throws");
    expect(extract.status, extract.stderr).toBe(0);
    const source = read<Catalog>("en.json");
    const action = Object.entries(source).find(([, entry]) => entry.description === "Opens the project");
    const status = Object.entries(source).find(([, entry]) => entry.description === "Unresolved ticket status");
    expect(Object.keys(source)).toHaveLength(2);
    expect(action?.[0]).toHaveLength(6);
    expect(status?.[0]).not.toBe(action?.[0]);

    const generate = run("generate-ids.mjs", "en.json", "generated/ids.json");
    expect(generate.status, generate.stderr).toBe(0);
    const ids = read<Record<string, string>>("generated/ids.json");
    expect(ids["Open\0Opens the project"]).toBe(action?.[0]);
    expect(ids["Open\0Unresolved ticket status"]).toBe(status?.[0]);
    expect(ids["Open"]).toBeUndefined();

    write("de.json", Object.fromEntries(Object.entries(source).map(([id, entry]) => [id, {
      defaultMessage: entry.description === "Opens the project" ? "Öffnen" : "Offen",
    }])));
    const check = run("check-catalogs.mjs", "en.json", "generated/ids.json", "de.json");
    expect(check.status, check.stderr).toBe(0);
    const compile = run(formatjs, "compile", "de.json", "--ast", "--out-file", "compiled/de.json");
    expect(compile.status, compile.stderr).toBe(0);

    const descriptors = defineMessages({
      action: { defaultMessage: "Open", description: "Opens the project" },
      status: { defaultMessage: "Open", description: "Unresolved ticket status" },
    });
    const intl = createIntl({ locale: "de", defaultLocale: "en", messages: read("compiled/de.json") });
    function resolve(descriptor: { defaultMessage: string; description: string }) {
      const id = ids[`${descriptor.defaultMessage}\0${descriptor.description}`];
      if (!id) throw new Error("Descriptor missing from generated-ID map; run extraction");
      return { ...descriptor, id };
    }
    expect(intl.formatMessage(resolve(descriptors.action))).toBe("Öffnen");
    expect(intl.formatMessage(resolve(descriptors.status))).toBe("Offen");
    expect(() => resolve({ defaultMessage: "Not extracted", description: "New action" })).toThrow("missing from generated-ID map");
  });

  it("always includes the separator, even without a description", () => {
    write("en.json", { abc123: { defaultMessage: "Hello" } });
    expect(run("generate-ids.mjs", "en.json", "ids.json").status).toBe(0);
    expect(read("ids.json")).toEqual({ "Hello\0": "abc123" });
  });

  it("preserves multiline descriptor whitespace for exact runtime lookup", () => {
    fs.writeFileSync(path.join(dir, "messages.ts"), `
      import { defineMessages } from '@formatjs/intl'
      defineMessages({ title: { defaultMessage: 'Line one\\n  Line two', description: 'Multiline title' } })
    `);
    const extract = run(formatjs, "extract", "messages.ts", "--out-file", "en.json", "--id-interpolation-pattern", "[sha512:contenthash:base64:6]", "--preserve-whitespace", "--throws");
    expect(extract.status, extract.stderr).toBe(0);
    const generate = run("generate-ids.mjs", "en.json", "ids.json");
    expect(generate.status, generate.stderr).toBe(0);
    expect(read<Record<string, string>>("ids.json")["Line one\n  Line two\0Multiline title"]).toBeDefined();
  });

  it("compiles only locale JSON, not the nested map or previous compiled catalogs", () => {
    fs.mkdirSync(path.join(dir, "i18n/generated"), { recursive: true });
    write("i18n/en.json", { abc123: { defaultMessage: "Hello", description: "Greeting" } });
    write("i18n/de.json", { abc123: { defaultMessage: "Hallo" } });
    write("i18n/generated/ids.json", { "Hello\0Greeting": "abc123" });
    for (let i = 0; i < 2; i++) {
      const compile = run(formatjs, "compile-folder", "i18n", "i18n/compiled", "--ast");
      expect(compile.status, compile.stderr).toBe(0);
    }
    expect(fs.readdirSync(path.join(dir, "i18n/compiled")).sort()).toEqual(["de.json", "en.json"]);
  });

  it("checks transform-based catalogs without requiring an ID map", () => {
    write("en.json", { abc123: { defaultMessage: "Hello" } });
    write("de.json", { abc123: { defaultMessage: "Hallo" } });
    const check = run("check-catalogs.mjs", "en.json", "-", "de.json");
    expect(check.status, check.stderr).toBe(0);
  });

  function catalogFixture() {
    const text = '{count, plural, one {<b>{name}</b> has # item} other {<b>{name}</b> has # items}}';
    write("en.json", { abc123: { defaultMessage: text, description: "Cart summary" } });
    write("ids.json", { [`${text}\0Cart summary`]: "abc123" });
    write("de.json", { abc123: { defaultMessage: text } });
  }

  it("allows placeholder reordering and locale-specific plural categories", () => {
    catalogFixture();
    write("de.json", { abc123: { defaultMessage: '{count, plural, one {# Artikel für <b>{name}</b>} few {# Artikel für <b>{name}</b>} other {# Artikel für <b>{name}</b>}}' } });
    const result = run("check-catalogs.mjs", "en.json", "ids.json", "de.json");
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    { name: "empty translations", target: { abc123: { defaultMessage: "  " } }, error: "empty translation" },
    { name: "missing translations", target: {}, error: "missing or stale IDs" },
    { name: "stale IDs", target: { abc123: { defaultMessage: "Hallo" }, stale: { defaultMessage: "Alt" } }, error: "missing or stale IDs" },
    { name: "renamed placeholders", target: { abc123: { defaultMessage: "Hallo {person}" } }, error: "ICU placeholders differ" },
    { name: "invalid ICU", target: { abc123: { defaultMessage: "{count, plural, one {Hallo}}" } }, error: "MISSING_OTHER_CLAUSE" },
  ])("rejects $name", ({ target, error }) => {
    catalogFixture();
    write("de.json", target);
    const result = run("check-catalogs.mjs", "en.json", "ids.json", "de.json");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(error);
  });

  it.each([
    { ids: {}, error: "missing or stale entries" },
    { ids: { Hello: "abc123" }, error: "description separator" },
    { ids: { "Hello\0Other intent": "abc123" }, error: "missing or incorrect generated-ID map entry" },
  ])("rejects an incomplete or incorrectly keyed map: $ids", ({ ids, error }) => {
    catalogFixture();
    write("ids.json", ids);
    const result = run("check-catalogs.mjs", "en.json", "ids.json", "de.json");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(error);
  });
});
