import path from "node:path";
import { parse } from "@formatjs/icu-messageformat-parser";
import { createReactIntlAdapter } from "../catalog/react-intl.ts";
import { getConfigDir, loadConfig } from "../config/loader.ts";
import { placeholders } from "./locale.ts";

function getCatalogs(cwd: string, locale?: string) {
  const config = loadConfig(cwd);
  if (config.format !== "react-intl") {
    throw new Error('MCP message tools currently require format: "react-intl".');
  }
  if (locale && !config.locale.targets.includes(locale)) {
    throw new Error(`Not a configured target locale: ${locale}`);
  }
  const configDir = getConfigDir(cwd);
  const adapter = createReactIntlAdapter(configDir, config.catalogs);
  const sources = adapter.getCatalogPathsForLocale(config.locale.source);
  const locales = locale ? [locale] : config.locale.targets;
  const catalogs = locales.flatMap((targetLocale) => {
    const targets = adapter.getCatalogPathsForLocale(targetLocale);
    if (new Set(targets).size !== targets.length || targets.some((target) => sources.includes(target))) {
      throw new Error("Configure distinct catalog paths for each target and source catalog.");
    }
    return targets.map((targetPath, index) => ({
      locale: targetLocale,
      sourcePath: sources[index]!,
      targetPath,
    }));
  });
  return { config, adapter, configDir, catalogs };
}

function relativeCatalog(configDir: string, file: string) {
  return path.relative(configDir, file);
}

export function findMessages(
  cwd: string,
  text: string,
  inField: "source" | "translation",
  locale?: string,
) {
  const plan = getCatalogs(cwd, locale);
  if (!text.trim()) throw new Error("Search text must not be blank.");
  const needle = text.toLocaleLowerCase();
  const grouped = new Map<string, {
    id: string;
    source: string;
    context?: string;
    references?: string[];
    translations: Record<string, string>;
    catalogs: Record<string, string>;
  }>();
  for (const { locale: targetLocale, sourcePath, targetPath } of plan.catalogs) {
    for (const message of plan.adapter.readMessages(targetPath, sourcePath)) {
      const key = `${sourcePath}\0${message.id}`;
      const entry = grouped.get(key) ?? {
        id: message.id,
        source: message.source,
        ...(message.context === undefined ? {} : { context: message.context }),
        ...(message.references === undefined ? {} : { references: message.references }),
        translations: {},
        catalogs: {},
      };
      if (message.translation !== undefined) entry.translations[targetLocale] = message.translation;
      entry.catalogs[targetLocale] = relativeCatalog(plan.configDir, targetPath);
      grouped.set(key, entry);
    }
  }
  const messages = [...grouped.values()];
  const matchingValues = (message: (typeof messages)[number]) => inField === "source"
    ? [message.source]
    : Object.values(message.translations);
  const exact = messages.filter((message) => matchingValues(message).some((value) => value === text));
  const matched = exact.length ? exact : messages.filter((message) =>
    matchingValues(message).some((value) => value.toLocaleLowerCase().includes(needle)),
  );
  return {
    locales: locale ? [locale] : plan.config.locale.targets,
    in: inField,
    match: exact.length ? "exact" : matched.length ? "partial" : "none",
    results: matched,
    hint: matched.length && matched.every((message) => !message.references?.length)
      ? 'No source locations were extracted. Refresh the source catalog with FormatJS "--extract-source-location".'
      : undefined,
  };
}

type MessageSelector = { id?: string; source?: string; currentTranslation?: string; catalog?: string };
type TranslationUpdate = MessageSelector & { translation: string };

export function updateTranslations(cwd: string, locale: string, updates: TranslationUpdate[]) {
  const plan = getCatalogs(cwd, locale);
  if (!updates.length) throw new Error("Provide at least one translation update.");

  const accepted: Array<{
    catalog: string;
    id: string;
    source: string;
    previousTranslation: string | null;
    translation: string;
    references: string[];
    sourcePath: string;
    targetPath: string;
  }> = [];
  const keys = new Set<string>();

  for (const update of updates) {
    const { translation } = update;
    if (!translation.trim()) throw new Error("Translation must not be blank.");
    const selectorEntries = [update.id, update.source, update.currentTranslation].filter((value) => value !== undefined);
    if (selectorEntries.length !== 1) throw new Error("Each update must specify exactly one of id, source, or currentTranslation.");
    if (update.catalog && path.isAbsolute(update.catalog)) throw new Error("catalog must be project-relative.");

    const candidates = plan.catalogs.flatMap(({ sourcePath, targetPath }) => {
      const catalog = relativeCatalog(plan.configDir, targetPath);
      if (update.catalog && update.catalog !== catalog) return [];
      return plan.adapter.readMessages(targetPath, sourcePath)
        .filter((message) => update.id !== undefined ? message.id === update.id
          : update.source !== undefined ? message.source === update.source
            : message.translation === update.currentTranslation)
        .map((message) => ({ ...message, catalog, sourcePath, targetPath }));
    });
    if (candidates.length === 0) {
      throw new Error("No matching translated message found. Search again and confirm its current value.");
    }
    if (candidates.length > 1) {
      throw new Error(`Ambiguous message; specify catalog and/or id. Matches: ${candidates.map(({ catalog, id, references }) =>
        `${catalog}:${id}${references?.length ? ` (${references.join(", ")})` : ""}`).join("; ")}`);
    }
    const message = candidates[0]!;
    const key = `${message.targetPath}\0${message.id}`;
    if (keys.has(key)) throw new Error(`Duplicate update for ${message.catalog}:${message.id}.`);
    keys.add(key);
    try {
      if (placeholders(parse(message.source)) !== placeholders(parse(translation))) {
        throw new Error("ICU placeholders or selectors differ from the source.");
      }
    } catch (error) {
      throw new Error(`${message.catalog}: ${message.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    accepted.push({
      catalog: message.catalog,
      id: message.id,
      source: message.source,
      previousTranslation: message.translation ?? null,
      translation,
      references: message.references ?? [],
      sourcePath: message.sourcePath,
      targetPath: message.targetPath,
    });
  }

  for (const targetPath of new Set(accepted.map((message) => message.targetPath))) {
    const fileUpdates = accepted.filter((message) => message.targetPath === targetPath);
    const sourcePath = fileUpdates[0]!.sourcePath;
    plan.adapter.writeTranslations(targetPath, sourcePath, fileUpdates.map(({ id, translation }) => ({ id, translation })));
  }

  return {
    locale,
    updated: accepted.length,
    translations: accepted.map(({ sourcePath: _sourcePath, targetPath: _targetPath, ...message }) => message),
  };
}
