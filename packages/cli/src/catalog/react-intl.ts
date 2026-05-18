import fs from "node:fs";
import path from "node:path";
import type {
  TranslationUnit,
  TranslationResult,
} from "@p6t/core";
import type { CatalogAdapter } from "./adapter.ts";
import type { Config } from "@p6t/core";

// ---------------------------------------------------------------------------
// react-intl catalog types
// ---------------------------------------------------------------------------

/** Source catalog produced by @formatjs/cli extract. */
interface ReactIntlSourceEntry {
  defaultMessage: string;
  description?: string;
}

type ReactIntlSourceCatalog = Record<string, ReactIntlSourceEntry>;

/** Target catalog consumed at runtime (flat key/value). */
type ReactIntlTargetCatalog = Record<string, string>;

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

    readUntranslated(targetPath: string, sourcePath: string): TranslationUnit[] {
      const sourceCatalog = readJsonSafe<ReactIntlSourceCatalog | ReactIntlTargetCatalog>(sourcePath);
      if (!sourceCatalog) return [];

      const targetCatalog = readJsonSafe<ReactIntlTargetCatalog>(targetPath) ?? {};

      const units: TranslationUnit[] = [];
      const isRich = isRichCatalog(sourceCatalog);

      for (const [id, entry] of Object.entries(sourceCatalog)) {
        const targetValue = targetCatalog[id];
        if (
          typeof targetValue === "string" &&
          targetValue.trim() !== ""
        ) {
          continue;
        }

        const unit: TranslationUnit = { id, source: "" };

        if (isRich) {
          const richEntry = entry as ReactIntlSourceEntry;
          unit.source = richEntry.defaultMessage;
          if (richEntry.description) unit.context = richEntry.description;
        } else {
          unit.source = entry as string;
        }

        if (unit.source) {
          units.push(unit);
        }
      }

      return units;
    },

    writeTranslations(
      targetPath: string,
      sourcePath: string,
      results: TranslationResult[],
    ): void {
      const resultMap = new Map(results.map((r) => [r.id, r.translation]));

      let catalog: ReactIntlTargetCatalog;
      if (fs.existsSync(targetPath)) {
        catalog = readJsonSafe<ReactIntlTargetCatalog>(targetPath) ?? {};
      } else {
        catalog = {};
      }

      // Merge results into catalog
      for (const [id, translation] of resultMap) {
        catalog[id] = translation;
      }

      // Preserve order from source catalog where possible
      const sourceCatalog = readJsonSafe<ReactIntlSourceCatalog | ReactIntlTargetCatalog>(sourcePath);
      const ordered: ReactIntlTargetCatalog = {};
      if (sourceCatalog) {
        for (const id of Object.keys(sourceCatalog)) {
          if (id in catalog) {
            ordered[id] = catalog[id];
          }
        }
      }
      // Append any keys not in source (shouldn't happen, but be safe)
      for (const [id, translation] of Object.entries(catalog)) {
        if (!(id in ordered)) {
          ordered[id] = translation;
        }
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, JSON.stringify(ordered, null, 2) + "\n");
    },

    discoverCatalogs(cwd: string): string[] {
      return discoverJsonFiles(cwd);
    },

    extractSourceStrings(filePath: string): string[] {
      const catalog = readJsonSafe<ReactIntlSourceCatalog | ReactIntlTargetCatalog>(filePath);
      if (!catalog) return [];
      const isRich = isRichCatalog(catalog);
      const strings: string[] = [];
      for (const [id, entry] of Object.entries(catalog)) {
        if (!id) continue;
        if (isRich) {
          strings.push((entry as ReactIntlSourceEntry).defaultMessage);
        } else {
          strings.push(entry as string);
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

      let sourceCatalog: ReactIntlSourceCatalog | ReactIntlTargetCatalog | null = null;
      if (sourceFilePath) {
        sourceCatalog = readJsonSafe<ReactIntlSourceCatalog | ReactIntlTargetCatalog>(sourceFilePath);
      }

      const pairs: Array<{ source: string; translation: string }> = [];
      const isSourceRich = sourceCatalog ? isRichCatalog(sourceCatalog) : false;

      for (const [id, translation] of Object.entries(catalog)) {
        if (!translation.trim()) continue;
        let source = id;
        if (sourceCatalog) {
          const entry = (sourceCatalog as Record<string, unknown>)[id];
          if (isSourceRich && entry && typeof entry === "object" && entry !== null) {
            source = (entry as ReactIntlSourceEntry).defaultMessage;
          } else if (typeof entry === "string") {
            source = entry;
          }
        }
        pairs.push({ source, translation });
      }

      return pairs;
    },
  };
}
