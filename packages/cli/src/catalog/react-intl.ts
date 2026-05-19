import fs from "node:fs";
import path from "node:path";
import type {
  TranslationUnit,
  TranslationResult,
} from "@p6t/config";
import type {
  CatalogAdapter,
  OrphanedTranslation,
  PendingTranslations,
  TranslationGroup,
} from "./adapter.ts";
import type { Config } from "@p6t/config";

// ---------------------------------------------------------------------------
// react-intl catalog types
// ---------------------------------------------------------------------------

/** Source catalog produced by @formatjs/cli extract. */
interface ReactIntlSourceEntry {
  defaultMessage: string;
  description?: string;
  file?: string;
  line?: number;
  col?: number;
  start?: number;
  end?: number;
}

type ReactIntlSourceCatalog = Record<string, ReactIntlSourceEntry>;

/** Target catalog written by p6t (default format, same as source minus description). */
type ReactIntlTargetEntry = {
  defaultMessage: string;
  _p6t_source?: string;
  _p6t_description?: string;
};

type ReactIntlTargetCatalog = Record<string, ReactIntlTargetEntry>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveCatalogPath(
  template: string,
  locale: string,
  configDir: string,
): string {
  return path.resolve(configDir, template.replace("{locale}", locale));
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isRichCatalog(obj: unknown): obj is Record<string, ReactIntlSourceEntry> {
  if (typeof obj !== "object" || obj === null) return false;
  const values = Object.values(obj as Record<string, unknown>);
  if (values.length === 0) return false;
  return values.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "defaultMessage" in entry &&
      typeof (entry as { defaultMessage: unknown }).defaultMessage === "string",
  );
}

function discoverJsonFiles(cwd: string): string[] {
  const candidates: string[] = [];
  const dirs = [
    "lang",
    "src/lang",
    "messages",
    "src/messages",
    "i18n",
    "locales",
    "src/locales",
    "src/i18n",
  ];
  for (const dir of dirs) {
    const full = path.join(cwd, dir);
    if (!fs.existsSync(full)) continue;
    for (const entry of fs.readdirSync(full, { recursive: true }) as string[]) {
      if (entry.endsWith(".json")) {
        candidates.push(path.join(full, entry));
      }
    }
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export function createReactIntlAdapter(
  configDir: string,
  catalogs: Config["catalogs"],
): CatalogAdapter {
  if (!catalogs || catalogs.length === 0) {
    throw new Error(
      "react-intl adapter requires catalogs configured in i18n.json",
    );
  }

  function getCatalogPathsForLocale(locale: string): string[] {
    return catalogs!.map((c) => resolveCatalogPath(c.path, locale, configDir));
  }

  return {
    getCatalogPathsForLocale,

    readPendingTranslations(targetPath: string, sourcePath: string): PendingTranslations {
      const sourceCatalog =
        readJsonSafe<ReactIntlSourceCatalog | ReactIntlTargetCatalog>(sourcePath);
      if (!sourceCatalog) return { groups: [] };

      const targetCatalog =
        readJsonSafe<ReactIntlTargetCatalog>(targetPath) ?? {};
      const isRich = isRichCatalog(sourceCatalog);

      const unitsByFile = new Map<string, TranslationUnit[]>();
      let hasReferences = false;

      for (const [id, entry] of Object.entries(sourceCatalog)) {
        const targetValue = targetCatalog[id];
        if (
          typeof targetValue?.defaultMessage === "string" &&
          targetValue.defaultMessage.trim() !== ""
        ) {
          continue;
        }

        const unit: TranslationUnit = { id, source: "" };

        if (isRich) {
          const richEntry = entry as ReactIntlSourceEntry;
          unit.source = richEntry.defaultMessage;
          if (richEntry.description) unit.context = richEntry.description;
          if (richEntry.file != null && richEntry.line != null) {
            unit.references = [`${richEntry.file}:${richEntry.line}`];
            hasReferences = true;
          }
        } else {
          unit.source = entry as unknown as string;
        }

        if (!unit.source) continue;

        const file = unit.references?.[0]?.split(":")[0] ?? sourcePath;
        const group = unitsByFile.get(file);
        if (group) {
          group.push(unit);
        } else {
          unitsByFile.set(file, [unit]);
        }
      }

      if (!hasReferences && unitsByFile.size > 0) {
        console.warn(
          "[p6t] Source file references not found in react-intl catalog. " +
            "Translations will be grouped by catalog file instead of by component. " +
            'For better results, run `formatjs extract` with `--extract-source-location`.',
        );
      }

      const groups: TranslationGroup[] = [];
      for (const [sourceFile, units] of unitsByFile) {
        groups.push({ sourceFile, hasSourceRefs: hasReferences, units });
      }

      return { groups };
    },

    writeTranslations(
      targetPath: string,
      sourcePath: string,
      results: TranslationResult[],
    ): void {
      const sourceCatalog =
        readJsonSafe<ReactIntlSourceCatalog | ReactIntlTargetCatalog>(
          sourcePath,
        );
      const isRich = sourceCatalog ? isRichCatalog(sourceCatalog) : false;

      const sourceMap = sourceCatalog
        ? new Map(Object.entries(sourceCatalog))
        : new Map<string, unknown>();

      let catalog: ReactIntlTargetCatalog;
      if (fs.existsSync(targetPath)) {
        catalog = readJsonSafe<ReactIntlTargetCatalog>(targetPath) ?? {};
      } else {
        catalog = {};
      }

      // Merge results into catalog, preserving _p6t_* metadata from previous writes
      for (const result of results) {
        const sourceEntry = sourceMap.get(result.id);
        const entry: ReactIntlTargetEntry = {
          defaultMessage: result.translation,
        };

        if (isRich && sourceEntry && typeof sourceEntry === "object") {
          const rich = sourceEntry as ReactIntlSourceEntry;
          if (rich.description) entry._p6t_description = rich.description;
          entry._p6t_source = rich.defaultMessage;
        } else if (typeof sourceEntry === "string") {
          entry._p6t_source = sourceEntry;
        }

        catalog[result.id] = entry;
      }

      // Preserve order from source catalog where possible
      const ordered: ReactIntlTargetCatalog = {};
      if (sourceCatalog) {
        for (const id of Object.keys(sourceCatalog)) {
          if (id in catalog) {
            ordered[id] = catalog[id];
          }
        }
      }
      // Append any keys not in source (shouldn't happen, but be safe)
      for (const [id, entry] of Object.entries(catalog)) {
        if (!(id in ordered)) {
          ordered[id] = entry;
        }
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, JSON.stringify(ordered, null, 2) + "\n");
    },

    removeStaleKeys(
      targetPath: string,
      sourcePath: string,
    ): OrphanedTranslation[] {
      if (!fs.existsSync(targetPath)) return [];

      const catalog = readJsonSafe<ReactIntlTargetCatalog>(targetPath) ?? {};
      const sourceCatalog =
        readJsonSafe<ReactIntlSourceCatalog | ReactIntlTargetCatalog>(
          sourcePath,
        );
      if (!sourceCatalog) return [];

      const orphans: OrphanedTranslation[] = [];
      let modified = false;

      for (const id of Object.keys(catalog)) {
        if (!(id in sourceCatalog)) {
          const entry = catalog[id];
          orphans.push({
            id,
            source: entry._p6t_source,
            translation: entry.defaultMessage,
            context: entry._p6t_description,
          });
          delete catalog[id];
          modified = true;
        }
      }

      if (modified) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, JSON.stringify(catalog, null, 2) + "\n");
      }

      return orphans;
    },

    discoverCatalogs(cwd: string): string[] {
      return discoverJsonFiles(cwd);
    },

    extractSourceStrings(filePath: string): string[] {
      const catalog =
        readJsonSafe<ReactIntlSourceCatalog | ReactIntlTargetCatalog>(filePath);
      if (!catalog) return [];
      const isRich = isRichCatalog(catalog);
      const strings: string[] = [];
      for (const [id, entry] of Object.entries(catalog)) {
        if (!id) continue;
        if (isRich) {
          strings.push((entry as ReactIntlSourceEntry).defaultMessage);
        } else {
          strings.push(entry as unknown as string);
        }
      }
      return [...new Set(strings)];
    },

    extractTranslatedPairs(
      filePath: string,
      sourceFilePath?: string,
    ): Array<{ source: string; translation: string }> {
      const catalog = readJsonSafe<ReactIntlTargetCatalog>(filePath);
      if (!catalog) return [];

      let sourceCatalog: ReactIntlSourceCatalog | ReactIntlTargetCatalog | null =
        null;
      if (sourceFilePath) {
        sourceCatalog =
          readJsonSafe<ReactIntlSourceCatalog | ReactIntlTargetCatalog>(
            sourceFilePath,
          );
      }

      const pairs: Array<{ source: string; translation: string }> = [];
      const isSourceRich = sourceCatalog ? isRichCatalog(sourceCatalog) : false;

      for (const [id, entry] of Object.entries(catalog)) {
        const translation = entry.defaultMessage;
        if (!translation?.trim()) continue;
        let source = id;
        if (sourceCatalog) {
          const sourceEntry = (sourceCatalog as Record<string, unknown>)[id];
          if (
            isSourceRich &&
            sourceEntry &&
            typeof sourceEntry === "object" &&
            sourceEntry !== null
          ) {
            source = (sourceEntry as ReactIntlSourceEntry).defaultMessage;
          } else if (typeof sourceEntry === "string") {
            source = sourceEntry;
          }
        }
        pairs.push({ source, translation });
      }

      return pairs;
    },
  };
}
