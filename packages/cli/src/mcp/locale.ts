import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { createReactIntlAdapter } from "../catalog/react-intl.ts";
import { getConfigDir, loadConfig, resolveContextPath } from "../config/loader.ts";
import { loadContext } from "../context/loader.ts";

const TRANSLATION_GUIDANCE =
  "Translate only pending IDs. Use the project context and inspect source references when meaning is unclear. " +
  "Preserve ICU arguments, rich-text tags, select options and exact plural selectors; adapt plural categories to the target locale.";

const GLOSSARY_GUIDANCE =
  "Propose a glossary entry only when two plausible translations for the same product concept could confuse users across screens. " +
  "Named features and domain terms can qualify on their first use; ordinary phrases do not qualify just because they recur. " +
  "Show the source term, proposed translation, where it occurs, and why consistency matters. " +
  "A reviewer correction can be a candidate when it reflects a reusable preference. " +
  "Do not change the glossary unless the reviewer explicitly approves the specific entry.";

function fingerprint(filePath: string) {
  try {
    return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function inspectLocale(cwd: string, locale: string) {
  const config = loadConfig(cwd);
  const configDir = getConfigDir(cwd);
  if (locale === config.locale.source || !config.locale.targets.includes(locale)) {
    throw new Error(`Not a configured target locale: ${locale}`);
  }
  if (config.format !== "react-intl") {
    throw new Error('MCP locale updates currently require format: "react-intl".');
  }
  const adapter = createReactIntlAdapter(configDir, config.catalogs);
  const sources = adapter.getCatalogPathsForLocale(config.locale.source);
  const targets = adapter.getCatalogPathsForLocale(locale);
  if (new Set(targets).size !== targets.length || targets.some((target) => sources.includes(target))) {
    throw new Error("Configure distinct catalog paths for each target and source catalog.");
  }
  const snapshots = [...sources, ...targets].map(fingerprint);
  const files = targets.map((targetPath, index) => {
    const sourcePath = sources[index]!;
    const stale = adapter.readStaleKeys(targetPath, sourcePath);
    const groups = adapter.readPendingTranslations(targetPath, sourcePath).groups;
    return { sourcePath, targetPath, stale, groups, catalog: path.relative(configDir, targetPath) };
  });
  const context = loadContext(config, locale, configDir);
  const translationInstructions = config.translationInstructions ?? config.provider?.prompt;
  const glossaryPath = resolveContextPath(config.context.glossary, locale, configDir);
  const revision = createHash("sha256").update(JSON.stringify({
    locale, config, snapshots, targets, sources, context,
  })).digest("hex");
  return { adapter, files, context, revision, sourceLocale: config.locale.source, translationInstructions, glossaryPath };
}

export function prepareLocale(cwd: string, locale: string) {
  const plan = inspectLocale(cwd, locale);
  const pending = plan.files.reduce((n, file) => n + file.groups.reduce((m, g) => m + g.units.length, 0), 0);
  const obsolete = plan.files.reduce((n, file) => n + file.stale.length, 0);
  const next = pending > 0
    ? "For a review, report the plan without writing. For an authorized update, draft the pending translations and call apply_locale with this revision."
    : obsolete > 0
      ? 'For a review, report the obsolete keys without writing. For an authorized update, call apply_locale with this revision and "translations": [] to prune them.'
      : "This locale is up to date. No update is needed.";
  return {
    locale,
    sourceLocale: plan.sourceLocale,
    revision: plan.revision,
    pending,
    obsolete,
    next,
    context: plan.context,
    translationInstructions: plan.translationInstructions,
    glossaryPath: plan.glossaryPath,
    guidance: { translation: TRANSLATION_GUIDANCE, glossary: GLOSSARY_GUIDANCE },
    catalogs: plan.files.map(({ catalog, stale, groups }) => ({
      catalog,
      pending: groups.flatMap((g) => g.units),
      obsoleteIds: stale.map(({ id }) => id),
      examples: stale.filter(({ translation }) => translation?.trim()).slice(0, 20),
    })),
  };
}

function placeholders(elements: MessageFormatElement[]) {
  const names = new Set<string>();
  function visit(nodes: MessageFormatElement[]) {
    for (const node of nodes) {
      if (node.type === TYPE.literal || node.type === TYPE.pound) continue;
      let detail: unknown = null;
      if (node.type === TYPE.select || node.type === TYPE.plural) {
        const options = Object.keys(node.options).sort();
        detail = node.type === TYPE.select ? options :
          [node.pluralType, node.offset, options.filter((key) => key.startsWith("="))];
        for (const option of Object.values(node.options)) visit(option.value);
      } else if (node.type === TYPE.tag) {
        visit(node.children);
      }
      names.add(JSON.stringify([node.type, node.value, detail]));
    }
  }
  visit(elements);
  return JSON.stringify([...names].sort());
}

interface CatalogTranslation {
  catalog: string;
  id: string;
  translation: string;
}

export function applyLocale(
  cwd: string, locale: string, revision: string, translations: CatalogTranslation[],
) {
  const plan = inspectLocale(cwd, locale);
  if (revision !== plan.revision) {
    throw new Error(`Locale inputs changed after preparation. Call prepare_locale again for ${locale} and check the new plan before applying.`);
  }
  const pending = new Map(plan.files.map((file) => [
    file.catalog, new Map(file.groups.flatMap(({ units }) => units.map((unit) => [unit.id, unit]))),
  ]));
  const accepted = new Map<string, CatalogTranslation[]>();
  for (const result of translations) {
    const units = pending.get(result.catalog);
    const unit = units?.get(result.id);
    const label = `${result.catalog}: ${result.id}`;
    if (!unit) throw new Error(`${label} is not pending or was submitted twice.`);
    if (!result.translation.trim()) throw new Error(`${label}: translation is blank.`);
    try {
      if (placeholders(parse(unit.source)) !== placeholders(parse(result.translation))) {
        throw new Error("ICU placeholders or selectors differ from the source.");
      }
    } catch (error) {
      throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
    units!.delete(result.id);
    const fileResults = accepted.get(result.catalog) ?? [];
    fileResults.push(result);
    accepted.set(result.catalog, fileResults);
  }

  const catalogs = plan.files.map(({ catalog, sourcePath, targetPath, stale }) => {
    const results = accepted.get(catalog) ?? [];
    const pruned = stale.length ? plan.adapter.removeStaleKeys(targetPath, sourcePath) : [];
    if (results.length) plan.adapter.writeTranslations(targetPath, sourcePath, results);
    return {
      catalog,
      translated: results.length,
      prunedIds: pruned.map(({ id }) => id),
      remainingIds: [...pending.get(catalog)!.keys()],
    };
  });
  return {
    locale,
    translated: translations.length,
    pruned: catalogs.reduce((n, file) => n + file.prunedIds.length, 0),
    remaining: catalogs.reduce((n, file) => n + file.remainingIds.length, 0),
    catalogs,
  };
}
