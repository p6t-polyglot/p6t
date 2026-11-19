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
  expect(plan).toMatchObject({ pending: 0, obsolete: 3 });
  expect(read("de.json")).toBe(before);

  const result = await apply(plan.revision);
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toMatchObject({ translated: 0, pruned: 3, remaining: 0 });
  expect(JSON.parse(read("de.json"))).toEqual({ keep: { defaultMessage: "Behalten" } });
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
  expect((await apply(plan.revision)).isError).toBe(true);
  expect(read("de.json")).toBe(before);
});

it("does not treat malformed source data as an empty catalog", async () => {
  put("en.json", []);
  put("de.json", { banner: { defaultMessage: "Willkommen" } });
  const result = await client.callTool({ name: "prepare_locale", arguments: { locale: "de" } });
  expect(result.isError).toBe(true);
  expect(JSON.parse(read("de.json"))).toHaveProperty("banner");
});

it("inspects an unconfigured project and scaffolds without overwriting existing context", async () => {
  fs.unlinkSync(path.join(dir, "i18n.json"));
  fs.mkdirSync(path.join(dir, "i18n/de"), { recursive: true });
  put("i18n/en.json", { welcome: { defaultMessage: "Welcome" } });
  put("i18n/de/glossary.json", { Workspace: "Arbeitsbereich" });

  const inspection = await client.callTool({ name: "inspect_project", arguments: {} });
  expect(inspection.structuredContent).toMatchObject({ configFile: null, catalogCandidates: ["i18n/en.json"] });
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
  expect(await prepare()).toMatchObject({ pending: 1 });

  const repeat = await client.callTool({ name: "init_project", arguments: { ...args, targetLocales: ["fr"] } });
  expect(repeat.isError).toBe(true);
  expect(JSON.parse(read("i18n.json"))).toEqual(config);
});
