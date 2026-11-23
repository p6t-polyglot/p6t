import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "node:path";
import { z } from "zod";
import { ConfigSchema } from "@p6t/config";
import { createReactIntlAdapter } from "../catalog/react-intl.ts";
import { findConfigFile, loadConfig } from "../config/loader.ts";
import { writeContextStubs, writeProjectConfig } from "../config/scaffold.ts";
import { DRAFTING_GUIDE } from "../context/drafting.ts";
import { applyLocale, prepareLocale } from "./locale.ts";
import { findMessages, updateTranslation } from "./messages.ts";

const PREPARE_DESCRIPTION =
  "Inspect pending and obsolete messages after adding, changing, or removing user-facing copy in a p6t project, " +
  "or when asked to review or update translations. Refresh the source catalog using the project's extraction command first. " +
  "Read-only. Omit locale to discover configured locales.";

const localeInput = z.string().regex(/^[a-z\d]+(?:-[a-z\d]+)*$/i)
  .describe("Locale identifier such as en, de, or pt-BR.");
const catalogTemplate = z.string().refine((template) =>
  !path.isAbsolute(template) && !template.split(/[\\/]/).includes("..") &&
  template.includes("{locale}") && template.endsWith(".json"),
  "Use a project-relative JSON catalog template containing {locale}, such as i18n/{locale}.json.",
);

export function createP6tMcpServer(cwd: string) {
  const server = new McpServer({ name: "p6t", version: "0.1.0" }, {
    instructions:
      "Use the p6t MCP tools instead of shelling out to p6t commands. " +
      "For initial setup, call inspect_project, agree on locales and catalog paths with the user, then call init_project. " +
      "When drafting or reviewing the project brief or locale guides, use the drafting recipe in inspect_project. " +
      `${PREPARE_DESCRIPTION} Follow the next step in the plan returned by prepare_locale. ` +
      "Use find_messages to locate copy by its exact source or translated text; it returns all matches and source references. " +
      "Use update_translation only for a specifically identified message and an authorized correction; it validates ICU structure and writes one entry. " +
      "Report what was translated and pruned, what remains, and any glossary candidates for separate reviewer approval.",
  });

  // Text content also works with hosts that don't display structured tool results.
  function result(structuredContent: Record<string, unknown>) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
      structuredContent,
    };
  }
  server.registerTool("inspect_project", {
    description: "Find p6t configuration and candidate react-intl catalogs before setup. Also returns the drafting recipe for writing or reviewing the project brief and locale style guides. Read-only.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, () => {
    const configFile = findConfigFile(cwd);
    const adapter = createReactIntlAdapter(cwd, [{ path: "i18n/{locale}.json" }]);
    return result({
      configFile,
      draftingGuide: DRAFTING_GUIDE,
      catalogCandidates: adapter.discoverCatalogs(cwd)
        .filter((file) => path.basename(file) !== "glossary.json" &&
          adapter.extractSourceStrings(file).some((message) => typeof message === "string" && message.trim()))
        .map((file) => path.relative(cwd, file)),
    });
  });

  server.registerTool("init_project", {
    description:
      "Scaffold a new react-intl p6t project with locale context stubs and no LLM provider. " +
      "Call only once the user agrees to the locale and catalog choices. Does not overwrite an existing project or context files.",
    inputSchema: {
      sourceLocale: localeInput,
      targetLocales: z.array(localeInput).min(1),
      catalogTemplates: z.array(catalogTemplate).min(1),
    },
    annotations: { destructiveHint: false, openWorldHint: false },
  }, ({ sourceLocale, targetLocales, catalogTemplates }) => {
    if (findConfigFile(cwd)) throw new Error("A p6t config already exists in this project or a parent directory.");
    const localeNames = [sourceLocale, ...targetLocales].map((locale) => locale.toLowerCase());
    if (new Set(localeNames).size !== localeNames.length) {
      throw new Error("Source and target locales must be distinct.");
    }
    const catalogs = catalogTemplates.map((template) => ({ path: template }));
    const adapter = createReactIntlAdapter(cwd, catalogs);
    const paths = [sourceLocale, ...targetLocales]
      .flatMap((locale) => adapter.getCatalogPathsForLocale(locale));
    if (new Set(paths).size !== paths.length) throw new Error("Catalog paths must be distinct.");
    const config = ConfigSchema.parse({
      version: 1, format: "react-intl", locale: { source: sourceLocale, targets: targetLocales }, catalogs,
    });
    writeProjectConfig(cwd, config, true);
    const created = ["i18n.json", ...writeContextStubs(cwd, config)];
    return result({
      created,
      next: "Draft and review the translation context using inspect_project's drafting guide. Then refresh your source catalogs with the project's extraction command and call prepare_locale.",
    });
  });

  server.registerTool("prepare_locale", {
    description: PREPARE_DESCRIPTION,
    inputSchema: { locale: z.string().min(1).optional() },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ locale }) => result(
    locale === undefined
      ? { locales: loadConfig(cwd).locale, next: "Call prepare_locale with the target locale you want to review or update." }
      : prepareLocale(cwd, locale),
  ));

  server.registerTool("apply_locale", {
    description:
      "For an authorized locale update, validate and write pending translations and prune all obsolete IDs in the prepared plan. Does not edit the glossary.",
    inputSchema: {
      locale: z.string().min(1),
      revision: z.string().describe("Revision returned by prepare_locale."),
      translations: z.array(z.object({
        catalog: z.string().describe("Catalog identifier returned by prepare_locale."),
        id: z.string(),
        translation: z.string(),
      })),
    },
    annotations: { destructiveHint: true, openWorldHint: false },
  }, ({ locale, revision, translations }) => result(applyLocale(cwd, locale, revision, translations)));

  server.registerTool("find_messages", {
    description:
      "Find react-intl messages by source or translated text. Exact matches are preferred; if none exist, returns case-insensitive substring matches. Returns every match with catalog, ID, context and source references. For source searches, provide a target locale when you need the corresponding target catalog path for a later update. Read-only.",
    inputSchema: {
      text: z.string().min(1),
      in: z.enum(["source", "translation"]).describe("Which side of the message to search."),
      locale: localeInput.optional().describe("Required for translation searches. For source searches, defaults to the source locale; provide a target locale to get its paired catalog path and current translation too."),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, ({ text, in: inField, locale }) => result(findMessages(cwd, text, inField, locale)));

  server.registerTool("update_translation", {
    description:
      "Update one authorized translation by its source text, current translated text, or stable message ID. Specify exactly one selector. Ambiguous selectors are rejected; use find_messages and then provide catalog and/or ID. Validates ICU placeholders and selectors. Writes only the selected translation; does not prune.",
    inputSchema: {
      locale: localeInput,
      translation: z.string(),
      id: z.string().optional().describe("Stable message ID."),
      source: z.string().optional().describe("Exact source-language text."),
      currentTranslation: z.string().optional().describe("Exact current target-language text (compare-and-swap selector)."),
      catalog: z.string().optional().describe("Project-relative target catalog path returned by find_messages."),
    },
    annotations: { destructiveHint: true, openWorldHint: false },
  }, ({ locale, translation, id, source, currentTranslation, catalog }) =>
    result(updateTranslation(cwd, locale, {
      ...(id === undefined ? {} : { id }),
      ...(source === undefined ? {} : { source }),
      ...(currentTranslation === undefined ? {} : { currentTranslation }),
      ...(catalog === undefined ? {} : { catalog }),
    }, translation)));

  return server;
}
