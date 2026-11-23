import path from "node:path";
import { parse } from "@formatjs/icu-messageformat-parser";
import { createReactIntlAdapter } from "../catalog/react-intl.ts";
import { getConfigDir, loadConfig } from "../config/loader.ts";
import { placeholders } from "./locale.ts";

function getCatalogs(cwd: string, locale: string) {
  const config = loadConfig(cwd);
  if (config.format !== "react-intl") {
    throw new Error('MCP message tools currently require format: "react-intl".');
  }
  if (locale !== config.locale.source && !config.locale.targets.includes(locale)) {
    throw new Error(`Not a configured locale: ${locale}`);
  }
  const configDir = getConfigDir(cwd);
  const adapter = createReactIntlAdapter(configDir, config.catalogs);
  const sources = adapter.getCatalogPathsForLocale(config.locale.source);
  const targets = adapter.getCatalogPathsForLocale(locale);
  if (locale === config.locale.source) {
    return { config, adapter, configDir, catalogs: sources.map((sourcePath) => ({ sourcePath, targetPath: sourcePath })) };
  }
  if (new Set(targets).size !== targets.length || targets.some((target) => sources.includes(target))) {
    throw new Error("Configure distinct catalog paths for each target and source catalog.");
  }
  return {
    config,
    adapter,
    configDir,
    catalogs: targets.map((targetPath, index) => ({ sourcePath: sources[index]!, targetPath })),
  };
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
  const config = loadConfig(cwd);
  const searchLocale = locale ?? (inField === "source" ? config.locale.source : undefined);
  if (!searchLocale) throw new Error("Specify a target locale when searching translated strings.");
  if (inField === "translation" && searchLocale === config.locale.source) {
    throw new Error("Translated-string searches require a target locale.");
  }
  const plan = getCatalogs(cwd, searchLocale);
  const needle = text.toLocaleLowerCase();
  if (!text.trim()) throw new Error("Search text must not be blank.");
  const all = plan.catalogs.flatMap(({ sourcePath, targetPath }) =>
    plan.adapter.readMessages(targetPath, sourcePath).map((message) => ({
      ...message,
      catalog: relativeCatalog(plan.configDir, targetPath),
      value: inField === "source" ? message.source : message.translation,
    })),
  ).filter((message) => typeof message.value === "string");
  const exact = all.filter((message) => message.value === text);
  const matched = exact.length ? exact : all.filter((message) =>
    message.value!.toLocaleLowerCase().includes(needle),
  );
  return {
    locale: searchLocale,
    in: inField,
    match: exact.length ? "exact" : matched.length ? "partial" : "none",
    results: matched.map(({ value: _value, ...message }) => {
      if (inField === "translation" || searchLocale !== config.locale.source) return message;
      const { translation: _translation, ...sourceMessage } = message;
      return sourceMessage;
    }),
    hint: matched.length && matched.every((message) => !message.references?.length)
      ? 'No source locations were extracted. Refresh the source catalog with FormatJS "--extract-source-location".'
      : undefined,
  };
}

type MessageSelector = { id?: string; source?: string; currentTranslation?: string; catalog?: string };

export function updateTranslation(
  cwd: string,
  locale: string,
  selector: MessageSelector,
  translation: string,
) {
  const plan = getCatalogs(cwd, locale);
  if (locale === plan.config.locale.source) throw new Error("Cannot update the source locale.");
  if (!translation.trim()) throw new Error("Translation must not be blank.");
  const selectorEntries = [selector.id, selector.source, selector.currentTranslation].filter((value) => value !== undefined);
  if (selectorEntries.length !== 1) throw new Error("Specify exactly one of id, source, or currentTranslation.");
  if (selector.catalog && path.isAbsolute(selector.catalog)) throw new Error("catalog must be project-relative.");

  const candidates = plan.catalogs.flatMap(({ sourcePath, targetPath }) => {
    const catalog = relativeCatalog(plan.configDir, targetPath);
    if (selector.catalog && selector.catalog !== catalog) return [];
    return plan.adapter.readMessages(targetPath, sourcePath)
      .filter((message) => selector.id !== undefined ? message.id === selector.id
        : selector.source !== undefined ? message.source === selector.source
          : message.translation === selector.currentTranslation)
      .map((message) => ({ ...message, catalog, sourcePath, targetPath }));
  });
  if (candidates.length === 0) throw new Error("No matching translated message found. Search again and confirm its current value.");
  if (candidates.length > 1) {
    throw new Error(`Ambiguous message; specify catalog and/or id. Matches: ${candidates.map(({ catalog, id, references }) =>
      `${catalog}:${id}${references?.length ? ` (${references.join(", ")})` : ""}`).join("; ")}`);
  }
  const message = candidates[0]!;
  try {
    if (placeholders(parse(message.source)) !== placeholders(parse(translation))) {
      throw new Error("ICU placeholders or selectors differ from the source.");
    }
  } catch (error) {
    throw new Error(`${message.catalog}: ${message.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
  plan.adapter.writeTranslations(message.targetPath, message.sourcePath, [{ id: message.id, translation }]);
  return {
    locale,
    catalog: message.catalog,
    id: message.id,
    source: message.source,
    previousTranslation: message.translation ?? null,
    translation,
    references: message.references ?? [],
  };
}
