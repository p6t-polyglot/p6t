import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const loader = new URL("../load-env.ts", import.meta.url).href;
const key = "GOOGLE_GENERATIVE_AI_API_KEY";

describe("environment file loading", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "p6t-env-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function load(shellValue?: string) {
    const env = { ...process.env };
    delete env[key];
    if (shellValue !== undefined) env[key] = shellValue;

    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      await import(${JSON.stringify(loader)});
      console.log(JSON.stringify(process.env[${JSON.stringify(key)}] ?? null));
    `], { cwd: dir, env, encoding: "utf8" });

    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout) as string | null;
  }

  it("loads a 53-character Google key from .env.local alone", () => {
    const value = "x".repeat(53);
    fs.writeFileSync(path.join(dir, ".env.local"), `${key}=${value}\n`);
    expect(load()).toBe(value);
  });

  it("prefers .env.local over .env", () => {
    fs.writeFileSync(path.join(dir, ".env"), `${key}=base\n`);
    fs.writeFileSync(path.join(dir, ".env.local"), `${key}=local\n`);
    expect(load()).toBe("local");
  });

  it("preserves shell variables, including an explicitly empty value", () => {
    fs.writeFileSync(path.join(dir, ".env"), `${key}=base\n`);
    fs.writeFileSync(path.join(dir, ".env.local"), `${key}=local\n`);
    expect(load("shell")).toBe("shell");
    expect(load("")).toBe("");
  });

  it("supports .env alone and absent files", () => {
    expect(load()).toBeNull();
    fs.writeFileSync(path.join(dir, ".env"), `${key}=base\n`);
    expect(load()).toBe("base");
  });

  it("loads .env.local before provider validation in the built CLI", () => {
    fs.writeFileSync(path.join(dir, ".env.local"), `${key}=${"x".repeat(53)}\n`);
    fs.writeFileSync(path.join(dir, "i18n.json"), JSON.stringify({
      version: 1,
      format: "react-intl",
      locale: { source: "en", targets: ["de"] },
      catalogs: [{ path: "{locale}.json" }],
      provider: { id: "google", model: "test-model" },
    }));
    fs.writeFileSync(path.join(dir, "en.json"), JSON.stringify({ greeting: { defaultMessage: "Hello" } }));
    fs.writeFileSync(path.join(dir, "de.json"), JSON.stringify({ greeting: { defaultMessage: "Hallo" } }));
    const env = { ...process.env };
    delete env[key];
    delete env["GOOGLE_API_KEY"];
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL("../../dist/index.js", import.meta.url)), "translate", "--json",
    ], { cwd: dir, env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ files: [{ pending: 0 }], errors: [] });
    expect(result.stderr).not.toContain("env var is not set");
  });
});
