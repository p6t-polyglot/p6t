import fs from "node:fs";
import path from "node:path";
import { po } from "gettext-parser";
import type { GetTextTranslations, GetTextTranslation } from "gettext-parser";
import type { TranslationUnit, TranslationResult } from "@p6t/config";
import type {
  CatalogAdapter,
  OrphanedTranslation,
  PendingTranslations,
  TranslationGroup,
} from "./adapter.ts";
import type { Config } from "@p6t/config";
import { getConfig } from "@lingui/conf";

// ---------------------------------------------------------------------------
// Lingui config
// ---------------------------------------------------------------------------

interface LinguiCatalogPath {
  path: string;
}

interface LinguiProject {
  rootDir: string;
  locales: string[];
  catalogPaths: LinguiCatalogPath[];
}

function loadLinguiConfig(cwd: string): LinguiProject | null {
  try {
    const config = getConfig({ cwd, skipValidation: true });
    return {
      rootDir: config.rootDir,
      locales: config.locales,
      catalogPaths: config.catalogs.map((catalog: { path: string }) => ({
        path: catalog.path,
      })),
    };
  } catch {
    return null;
  }
}

function resolveCatalogPath(
  template: string,
  locale: string,
  rootDir: string,
): string {
  const resolved = template
    .replace("<rootDir>", rootDir)
    .replace("{locale}", locale);
  return path.resolve(resolved + ".po");
}

// ---------------------------------------------------------------------------
// PO helpers
// ---------------------------------------------------------------------------

function makeId(msgctxt: string | undefined, msgid: string): string {
  return msgctxt ? `${msgctxt}\x04${msgid}` : msgid;
}

function isFuzzy(entry: GetTextTranslation): boolean {
  return entry.comments?.flag?.includes("fuzzy") ?? false;
}

function parsePo(filePath: string): GetTextTranslations | null {
  try {
    return po.parse(fs.readFileSync(filePath));
  } catch {
    return null;
  }
}

function discoverPoFiles(cwd: string): string[] {
  const candidates: string[] = [];
  for (const dir of ["locale", "locales", "src/locales", "src/locale"]) {
    const full = path.join(cwd, dir);
    if (!fs.existsSync(full)) continue;
    for (const entry of fs.readdirSync(full, {
      recursive: true,
    }) as string[]) {
      if (entry.endsWith(".po")) candidates.push(path.join(full, entry));
    }
  }
  return candidates;
}

/** Extract the file path from a PO reference string (e.g. "src/Cart.tsx:42" -> "src/Cart.tsx"). */
function refFile(ref: string): string {
  const idx = ref.lastIndexOf(":");
  return idx >= 0 ? ref.slice(0, idx) : ref;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export function createLinguiAdapter(
  configDir: string,
  _catalogs?: Config["catalogs"],
): CatalogAdapter {
  let linguiProject: LinguiProject | null = null;

  function ensureLinguiProject(): LinguiProject {
    if (!linguiProject) {
      linguiProject = loadLinguiConfig(configDir);
      if (!linguiProject) {
        throw new Error(
          "No lingui config found. Make sure lingui.config.ts (or equivalent) exists.",
        );
      }
    }
    return linguiProject;
  }

  function getCatalogPathsForLocale(locale: string): string[] {
    const project = ensureLinguiProject();
    return project.catalogPaths.map((catalog) =>
      resolveCatalogPath(catalog.path, locale, project.rootDir),
    );
  }

  return {
    getCatalogPathsForLocale,

    readPendingTranslations(
      targetPath: string,
      sourcePath: string,
    ): PendingTranslations {
      let targetPo: GetTextTranslations | null = null;
      if (fs.existsSync(targetPath)) {
        try {
          targetPo = po.parse(fs.readFileSync(targetPath));
        } catch {
          targetPo = null;
        }
      }

      if (!fs.existsSync(sourcePath)) return { groups: [] };
      const sourcePo = po.parse(fs.readFileSync(sourcePath));

      const unitsByFile = new Map<string, TranslationUnit[]>();

      for (const [ctx, entries] of Object.entries(sourcePo.translations)) {
        for (const [msgid, entry] of Object.entries(entries)) {
          if (!msgid) continue;

          const id = makeId(ctx || undefined, msgid);
          const targetEntry: GetTextTranslation | undefined =
            targetPo?.translations[ctx]?.[msgid];

          const existingTranslation = targetEntry?.msgstr?.[0];
          if (
            existingTranslation &&
            existingTranslation.trim() !== "" &&
            targetEntry &&
            !isFuzzy(targetEntry)
          ) {
            continue;
          }

          const unit: TranslationUnit = {
            id,
            source: entry.msgid,
          };

          if (entry.msgid_plural) unit.sourcePlural = entry.msgid_plural;

          const extracted = entry.comments?.extracted;
          if (extracted) unit.context = extracted;

          const refs = entry.comments?.reference;
          if (refs) {
            unit.references = refs.split("\n").filter(Boolean);
          }

          const file = unit.references?.[0] ? refFile(unit.references[0]) : sourcePath;
          const group = unitsByFile.get(file);
          if (group) {
            group.push(unit);
          } else {
            unitsByFile.set(file, [unit]);
          }
        }
      }

      const hasReferences = unitsByFile.size > 0 &&
        Array.from(unitsByFile.values()).some((units) =>
          units.some((u) => u.references != null && u.references.length > 0),
        );

      const groups: TranslationGroup[] = [];
      for (const [sourceFile, units] of unitsByFile) {
        groups.push({ sourceFile, hasSourceRefs: hasReferences, units });
      }

      return { groups };
    },

    writeTranslations(
      filePath: string,
      sourceFilePath: string,
      results: TranslationResult[],
    ): void {
      const resultMap = new Map(results.map((r) => [r.id, r.translation]));

      let catalog: GetTextTranslations;
      if (fs.existsSync(filePath)) {
        catalog = po.parse(fs.readFileSync(filePath));
      } else {
        const source = po.parse(fs.readFileSync(sourceFilePath));
        catalog = {
          charset: source.charset,
          headers: { ...source.headers },
          translations: {},
        };
      }

      for (const result of results) {
        const sepIdx = result.id.indexOf("\x04");
        const ctx = sepIdx >= 0 ? result.id.slice(0, sepIdx) : "";
        const msgid = sepIdx >= 0 ? result.id.slice(sepIdx + 1) : result.id;

        if (!catalog.translations[ctx]) catalog.translations[ctx] = {};

        const existing = catalog.translations[ctx][msgid];
        const { flag: _flag, ...commentsWithoutFlag } =
          existing?.comments ?? {};
        catalog.translations[ctx][msgid] = {
          ...(existing ?? { msgid }),
          msgstr: [resultMap.get(result.id) ?? ""],
          comments: commentsWithoutFlag,
        };
      }

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, po.compile(catalog));
    },

    removeStaleKeys(
      filePath: string,
      sourceFilePath: string,
    ): OrphanedTranslation[] {
      if (!fs.existsSync(filePath) || !fs.existsSync(sourceFilePath)) {
        return [];
      }

      const catalog = po.parse(fs.readFileSync(filePath));
      const source = po.parse(fs.readFileSync(sourceFilePath));

      const orphans: OrphanedTranslation[] = [];
      let modified = false;

      for (const ctx of Object.keys(catalog.translations)) {
        for (const msgid of Object.keys(catalog.translations[ctx])) {
          if (!msgid) continue;
          if (!source.translations[ctx]?.[msgid]) {
            const entry = catalog.translations[ctx][msgid];
            orphans.push({
              id: makeId(ctx || undefined, msgid),
              source: entry.msgid,
              translation: entry.msgstr?.[0] ?? "",
              context: entry.comments?.extracted,
            });
            delete catalog.translations[ctx][msgid];
            modified = true;
          }
        }
        // Clean up empty contexts
        if (Object.keys(catalog.translations[ctx]).length === 0) {
          delete catalog.translations[ctx];
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, po.compile(catalog));
      }

      return orphans;
    },

    discoverCatalogs(cwd: string): string[] {
      return discoverPoFiles(cwd);
    },

    extractSourceStrings(filePath: string): string[] {
      const catalog = parsePo(filePath);
      if (!catalog) return [];
      const strings: string[] = [];
      for (const entries of Object.values(catalog.translations)) {
        for (const [msgid, entry] of Object.entries(entries)) {
          if (!msgid) continue;
          strings.push(entry.msgid);
        }
      }
      return [...new Set(strings)];
    },

    extractTranslatedPairs(
      filePath: string,
      _sourceFilePath?: string,
    ): Array<{ source: string; translation: string }> {
      const catalog = parsePo(filePath);
      if (!catalog) return [];
      const pairs: Array<{ source: string; translation: string }> = [];
      for (const entries of Object.values(catalog.translations)) {
        for (const [msgid, entry] of Object.entries(entries)) {
          if (!msgid) continue;
          const translation = entry.msgstr?.[0];
          if (translation && translation.trim()) {
            pairs.push({ source: entry.msgid, translation });
          }
        }
      }
      return pairs;
    },
  };
}
