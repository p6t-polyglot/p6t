import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createP6tMcpServer } from "../server.ts";

let dir: string;
let client: Client;
const put = (file: string, data: unknown) =>
  fs.writeFileSync(path.join(dir, file), JSON.stringify(data));
const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "p6t-mcp-"));
  put("i18n.json", {
    version: 1, format: "react-intl",
    locale: { source: "en", targets: ["de"] },
    catalogs: [{ path: "{locale}.json" }],
  });
  client = new Client({ name: "p6t-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createP6tMcpServer(dir).connect(serverTransport);
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function prepare() {
  const result = await client.callTool({ name: "prepare_locale", arguments: { locale: "de" } });
  expect(result.isError).not.toBe(true);
  return result.structuredContent as { revision: string };
}

function apply(revision: string, translations: Array<{ catalog: string; id: string; translation: string }> = []) {
  return client.callTool({ name: "apply_locale", arguments: { locale: "de", revision, translations } });
}

it("prepares without writing and applies a prune-only update without a provider", async () => {
  put("en.json", { keep: { defaultMessage: "Keep" } });
  put("de.json", {
    keep: { defaultMessage: "Behalten" },
    one: { defaultMessage: "Eins" },
    two: { defaultMessage: "Zwei" },
    three: { defaultMessage: "Drei" },
  });
  const before = read("de.json");
  const plan = await prepare();
  expect(plan).toMatchObject({
    pending: 0,
    obsolete: 3,
    next: expect.stringMatching(/apply_locale.*"translations": \[\]/),
  });
  expect(read("de.json")).toBe(before);

  const result = await apply(plan.revision);
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toMatchObject({ translated: 0, pruned: 3, remaining: 0 });
  expect(JSON.parse(read("de.json"))).toEqual({ keep: { defaultMessage: "Behalten" } });
  expect(await prepare()).toMatchObject({ next: "This locale is up to date. No update is needed." });
});

it("prepares checkout copy and context, rejects broken ICU, then writes a reviewed diff", async () => {
  fs.mkdirSync(path.join(dir, "i18n/de"), { recursive: true });
  put("i18n/de/glossary.json", { Workspace: "Arbeitsbereich" });
  put("en.json", {
    checkout: { defaultMessage: "Pay {amount}", description: "Checkout button", file: "src/checkout.tsx", line: 42 },
    receipt: { defaultMessage: "Receipt" },
  });
  put("de.json", {
    checkout: { defaultMessage: "Jetzt zahlen", _p6t_source: "Pay now" },
    oldBanner: { defaultMessage: "Alt" },
  });
  const before = read("de.json");
  const plan = await prepare();
  expect(plan).toMatchObject({
    next: expect.stringMatching(/draft the pending translations.*apply_locale/),
    context: { glossary: { Workspace: "Arbeitsbereich" } },
    catalogs: [{
      catalog: "de.json",
      pending: [
        { id: "checkout", source: "Pay {amount}", context: "Checkout button", references: ["src/checkout.tsx:42"] },
        { id: "receipt" },
      ],
      obsoleteIds: ["oldBanner"],
    }],
  });
  const broken = await apply(plan.revision, [{ catalog: "de.json", id: "checkout", translation: "Zahlen" }]);
  expect(broken.isError).toBe(true);
  expect(read("de.json")).toBe(before);

  const valid = await apply(plan.revision, [{ catalog: "de.json", id: "checkout", translation: "{amount} zahlen" }]);
  expect(valid.isError).not.toBe(true);
  expect(valid.structuredContent).toMatchObject({
    translated: 1, pruned: 1, remaining: 1,
    catalogs: [{ prunedIds: ["oldBanner"], remainingIds: ["receipt"] }],
  });
  expect(JSON.parse(read("de.json"))).toEqual({
    checkout: { defaultMessage: "{amount} zahlen", _p6t_source: "Pay {amount}", _p6t_description: "Checkout button" },
  });
  expect(JSON.parse(read("i18n/de/glossary.json"))).toEqual({ Workspace: "Arbeitsbereich" });
});

it("rejects a plan if an obsolete key was restored to the source catalog", async () => {
  put("en.json", {});
  put("de.json", { banner: { defaultMessage: "Willkommen" } });
  const plan = await prepare();
  const before = read("de.json");
  put("en.json", { banner: { defaultMessage: "Welcome" } });
  const result = await apply(plan.revision);
  expect(result.isError).toBe(true);
  expect(result.content).toEqual([
    expect.objectContaining({ text: expect.stringContaining("Call prepare_locale again for de") }),
  ]);
  expect(read("de.json")).toBe(before);
});

it("does not treat malformed source data as an empty catalog", async () => {
  put("en.json", []);
  put("de.json", { banner: { defaultMessage: "Willkommen" } });
  const result = await client.callTool({ name: "prepare_locale", arguments: { locale: "de" } });
  expect(result.isError).toBe(true);
  expect(JSON.parse(read("de.json"))).toHaveProperty("banner");
});

it("finds copy across target locales and supports safe batch edits", async () => {
  put("i18n.json", {
    version: 1, format: "react-intl",
    locale: { source: "en", targets: ["de", "fr"] },
    catalogs: [{ path: "{locale}.json" }],
  });
  put("en.json", {
    save: { defaultMessage: "Save {name}", description: "Save button", file: "src/form.tsx", line: 12 },
    cancel: { defaultMessage: "Cancel", file: "src/form.tsx", line: 14 },
    otherSave: { defaultMessage: "Save {name}", description: "Save menu item", file: "src/menu.tsx", line: 8 },
  });
  put("de.json", {
    save: { defaultMessage: "{name} speichern", _p6t_source: "Save {name}", _p6t_description: "Save button" },
    cancel: { defaultMessage: "Abbrechen", _p6t_source: "Cancel" },
  });
  put("fr.json", { save: { defaultMessage: "Enregistrer {name}" } });

  const source = await client.callTool({ name: "find_messages", arguments: { text: "Save {name}", in: "source" } });
  expect(source.structuredContent).toMatchObject({
    match: "exact",
    results: [
      {
        id: "save", source: "Save {name}", context: "Save button", translations: { de: "{name} speichern", fr: "Enregistrer {name}" },
        catalogs: { de: "de.json", fr: "fr.json" }, references: ["src/form.tsx:12"],
      },
      {
        id: "otherSave", source: "Save {name}", context: "Save menu item", translations: {},
        catalogs: { de: "de.json", fr: "fr.json" }, references: ["src/menu.tsx:8"],
      },
    ],
  });
  const translated = await client.callTool({ name: "find_messages", arguments: { text: "speichern", in: "translation", locale: "de" } });
  expect(translated.structuredContent).toMatchObject({
    match: "partial",
    results: [{ id: "save", source: "Save {name}", translations: { de: "{name} speichern" } }],
  });
  const unknown = await client.callTool({ name: "find_messages", arguments: { text: "not present", in: "source" } });
  expect(unknown.structuredContent).toMatchObject({ match: "none", results: [] });

  const ambiguous = await client.callTool({
    name: "update_translations",
    arguments: { locale: "de", updates: [{ source: "Save {name}", translation: "{name} sichern" }] },
  });
  expect(ambiguous.isError).toBe(true);
  expect(ambiguous.content).toEqual([expect.objectContaining({ text: expect.stringContaining("Ambiguous message") })]);

  const broken = await client.callTool({
    name: "update_translations",
    arguments: { locale: "de", updates: [{ id: "save", translation: "Sichern" }] },
  });
  expect(broken.isError).toBe(true);
  expect(JSON.parse(read("de.json")).save.defaultMessage).toBe("{name} speichern");

  const invalidBatch = await client.callTool({
    name: "update_translations",
    arguments: { locale: "de", updates: [
      { id: "save", translation: "{name} sichern" },
      { id: "cancel", translation: "" },
    ] },
  });
  expect(invalidBatch.isError).toBe(true);
  expect(JSON.parse(read("de.json")).save.defaultMessage).toBe("{name} speichern");

  const updated = await client.callTool({
    name: "update_translations",
    arguments: { locale: "de", updates: [
      { currentTranslation: "{name} speichern", translation: "{name} sichern" },
      { id: "cancel", translation: "Abbrechen" },
    ] },
  });
  expect(updated.isError).not.toBe(true);
  expect(updated.structuredContent).toMatchObject({
    updated: 2,
    translations: [
      { id: "save", previousTranslation: "{name} speichern", translation: "{name} sichern", references: ["src/form.tsx:12"] },
      { id: "cancel", previousTranslation: "Abbrechen", translation: "Abbrechen" },
    ],
  });
  expect(JSON.parse(read("de.json")).save).toEqual({
    defaultMessage: "{name} sichern", _p6t_source: "Save {name}", _p6t_description: "Save button",
  });
});

it("supports source selection and rejects updates to the source locale", async () => {
  put("en.json", { welcome: { defaultMessage: "Welcome" } });
  put("de.json", { welcome: { defaultMessage: "Willkommen" } });
  const update = await client.callTool({
    name: "update_translations",
    arguments: { locale: "de", updates: [{ source: "Welcome", translation: "Guten Tag" }] },
  });
  expect(update.isError).not.toBe(true);
  expect(JSON.parse(read("de.json")).welcome.defaultMessage).toBe("Guten Tag");

  const sourceUpdate = await client.callTool({
    name: "update_translations",
    arguments: { locale: "en", updates: [{ id: "welcome", translation: "Hi" }] },
  });
  expect(sourceUpdate.isError).toBe(true);
  expect(JSON.parse(read("en.json")).welcome.defaultMessage).toBe("Welcome");
});

it("inspects an unconfigured project and scaffolds without overwriting existing context", async () => {
  fs.unlinkSync(path.join(dir, "i18n.json"));
  fs.mkdirSync(path.join(dir, "i18n/de"), { recursive: true });
  put("i18n/en.json", { welcome: { defaultMessage: "Welcome" } });
  put("i18n/de/glossary.json", { Workspace: "Arbeitsbereich" });

  const inspection = await client.callTool({ name: "inspect_project", arguments: {} });
  expect(inspection.structuredContent).toMatchObject({ configFile: null, catalogCandidates: ["i18n/en.json"] });
  expect(inspection.structuredContent).toMatchObject({
    draftingGuide: {
      inspect: expect.stringContaining("representative screens"),
      description: expect.stringContaining("jobs they do"),
      styleGuide: expect.stringContaining("a trigger, a preferred choice, and a real or representative target-language example"),
      review: expect.stringContaining("leave the choice out of the guide until settled"),
    },
  });
  expect(fs.existsSync(path.join(dir, "i18n.json"))).toBe(false);

  const args = { sourceLocale: "en", targetLocales: ["de"], catalogTemplates: ["i18n/{locale}.json"] };
  const init = await client.callTool({ name: "init_project", arguments: args });
  expect(init.isError).not.toBe(true);
  expect(init.structuredContent).toMatchObject({
    created: ["i18n.json", "i18n/description.md", "i18n/de/style-guide.md"],
  });
  const config = JSON.parse(read("i18n.json"));
  expect(config).not.toHaveProperty("provider");
  expect(JSON.parse(read("i18n/de/glossary.json"))).toEqual({ Workspace: "Arbeitsbereich" });
  const locale = await prepare();
  expect(locale).toMatchObject({ pending: 1 });
  expect(locale).not.toHaveProperty("draftingGuide");

  const repeat = await client.callTool({ name: "init_project", arguments: { ...args, targetLocales: ["fr"] } });
  expect(repeat.isError).toBe(true);
  expect(JSON.parse(read("i18n.json"))).toEqual(config);
});
