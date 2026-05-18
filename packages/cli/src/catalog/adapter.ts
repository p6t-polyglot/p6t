import fs from "node:fs";
import path from "node:path";
import type {
  TranslationUnit,
  TranslationResult,
} from "@p6t/core";
import type { Config } from "@p6t/core";

export type { TranslationUnit, TranslationResult } from "@p6t/core";

/** Format-agnostic seam for reading and writing translation catalogs. */
export interface CatalogAdapter {
  /** Resolve absolute catalog file paths for a locale. */
  getCatalogPathsForLocale(locale: string): string[];

  /** Read a target catalog against its source and return units needing translation. */
  readUntranslated(targetPath: string, sourcePath: string): TranslationUnit[];

  /** Write translation results back into the target catalog. */
  writeTranslations(
    targetPath: string,
    sourcePath: string,
    results: TranslationResult[],
  ): void;

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
          'react-intl requires catalogs in i18n.json, e.g. [{ "path": "lang/{locale}.json" }]',
        );
      }
      const { createReactIntlAdapter } = await import("./react-intl.ts");
      return createReactIntlAdapter(configDir, config.catalogs);
    }
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
