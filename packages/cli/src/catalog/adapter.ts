import fs from "node:fs";
import path from "node:path";
import type {
  TranslationUnit,
  TranslationResult,
} from "@p6t/config";
import type { Config } from "@p6t/config";

export type { TranslationUnit, TranslationResult } from "@p6t/config";

/** A group of translation units that share the same source-file context. */
export interface TranslationGroup {
  /** Source file path, or the catalog path when no refs are available. */
  sourceFile: string;
  /** Whether the sourceFile came from actual source-code references. */
  hasSourceRefs: boolean;
  units: TranslationUnit[];
}

/** A previously translated key that no longer exists in the source catalog. */
export interface OrphanedTranslation {
  id: string;
  /** The source text at the time the translation was written. */
  source: string | undefined;
  /** The translated text that was stored in the target catalog. */
  translation: string;
  /** Context / description at the time the translation was written. */
  context: string | undefined;
}

/** Untranslated work remaining after stale-key removal. */
export interface PendingTranslations {
  /** Untranslated units grouped by shared source-file context. */
  groups: TranslationGroup[];
}

/** Format-agnostic seam for reading and writing translation catalogs. */
export interface CatalogAdapter {
  /** Resolve absolute catalog file paths for a locale. */
  getCatalogPathsForLocale(locale: string): string[];

  /**
   * Read a target catalog against its source and return untranslated units,
   * grouped by source-file context.
   */
  readPendingTranslations(targetPath: string, sourcePath: string): PendingTranslations;

  /** Write translation results back into the target catalog. */
  writeTranslations(
    targetPath: string,
    sourcePath: string,
    results: TranslationResult[],
  ): void;

  /**
   * Remove keys from the target catalog that no longer exist in the source.
   * Returns rich metadata about the removed translations (orphans).
   */
  removeStaleKeys(
    targetPath: string,
    sourcePath: string,
  ): OrphanedTranslation[];

  /** Discover existing catalog files under cwd (for init/context seeding). */
  discoverCatalogs(cwd: string): string[];

  /** Extract source strings from a catalog file (for init). */
  extractSourceStrings(filePath: string): string[];

  /** Extract existing source→translation pairs (for init). */
  extractTranslatedPairs(
    filePath: string,
    sourceFilePath?: string,
  ): Array<{ source: string; translation: string }>;
}

function detectFormat(configDir: string): "lingui" | "react-intl" {
  // Lingui has a standard config file
  const linguiConfigNames = [
    "lingui.config.ts",
    "lingui.config.js",
    "lingui.config.mjs",
  ];
  for (const name of linguiConfigNames) {
    if (fs.existsSync(path.join(configDir, name))) return "lingui";
  }
  return "lingui"; // fallback for backward compatibility
}

/** Create the appropriate adapter for the configured format. */
export async function createAdapter(
  config: Config,
  configDir: string,
): Promise<CatalogAdapter> {
  const format = config.format ?? detectFormat(configDir);

  switch (format) {
    case "lingui": {
      const { createLinguiAdapter } = await import("./lingui.ts");
      return createLinguiAdapter(configDir, config.catalogs);
    }
    case "react-intl": {
      if (!config.catalogs || config.catalogs.length === 0) {
        throw new Error(
          'react-intl requires catalogs in i18n.json, e.g. [{ "path": "i18n/{locale}.json" }]',
        );
      }
      const { createReactIntlAdapter } = await import("./react-intl.ts");
      return createReactIntlAdapter(configDir, config.catalogs);
    }
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
