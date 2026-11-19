import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "node:path";
import { z } from "zod";
import { ConfigSchema } from "@p6t/config";
import { createReactIntlAdapter } from "../catalog/react-intl.ts";
import { findConfigFile, loadConfig } from "../config/loader.ts";
import { writeContextStubs, writeProjectConfig } from "../config/scaffold.ts";
import { DRAFTING_GUIDE } from "../context/drafting.ts";
import { applyLocale, prepareLocale } from "./locale.ts";

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
      `${PREPARE_DESCRIPTION} For a review, report the plan without writing. ` +
      "For an update, translate the pending messages yourself, then call apply_locale with the plan revision. " +
      "Apply even if there are only obsolete keys: pass an empty translations array to prune them. " +
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
      ? { locales: loadConfig(cwd).locale }
      : prepareLocale(cwd, locale),
  ));

  server.registerTool("apply_locale", {
    description:
      "For an authorized locale update, validate and write pending translations and prune all obsolete IDs in the prepared plan. " +
      "Use an empty translations array for pruning alone. Does not edit the glossary.",
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

  return server;
}
