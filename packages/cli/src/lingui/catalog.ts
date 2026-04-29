import fs from "node:fs";
import path from "node:path";
import { po } from "gettext-parser";
import type { GetTextTranslations, GetTextTranslation } from "gettext-parser";

export interface TranslationUnit {
  /** Stable identifier — the msgid (or msgctxt\x04msgid for contextual strings). */
  id: string;
  /** Source text as it appears in the .po file (may be ICU). */
  source: string;
  /** Plural source form, if this is a plural string. */
  sourcePlural?: string;
  /** Translator comment / extracted comment (description). */
  context?: string;
  /** Source file references, e.g. ["src/Cart.tsx:42"]. */
  references?: string[];
}

export interface TranslationResult {
  id: string;
  translation: string;
}

function makeId(msgctxt: string | undefined, msgid: string): string {
  return msgctxt ? `${msgctxt}\x04${msgid}` : msgid;
}

function isFuzzy(entry: GetTextTranslation): boolean {
  return entry.comments?.flag?.includes("fuzzy") ?? false;
}

/** Read a .po file and return all translation units that need translating. */
export function readUntranslated(
  filePath: string,
  sourceFilePath: string,
): TranslationUnit[] {
  // Read target catalog — may not exist yet
  let targetPo: GetTextTranslations | null = null;
  if (fs.existsSync(filePath)) {
    try {
      targetPo = po.parse(fs.readFileSync(filePath));
    } catch {
      targetPo = null;
    }
  }

  // Source catalog must exist
  if (!fs.existsSync(sourceFilePath)) return [];
  const sourcePo = po.parse(fs.readFileSync(sourceFilePath));

  const units: TranslationUnit[] = [];

  for (const [ctx, entries] of Object.entries(sourcePo.translations)) {
    for (const [msgid, entry] of Object.entries(entries)) {
      if (!msgid) continue; // skip the header entry

      const id = makeId(ctx || undefined, msgid);
      const targetEntry: GetTextTranslation | undefined =
        targetPo?.translations[ctx]?.[msgid];

      // Skip if already translated (non-empty, non-fuzzy)
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
      if (refs) unit.references = refs.split("\n").filter(Boolean);

      units.push(unit);
    }
  }

  return units;
}

/** Write translation results back into a .po file (create if absent). */
export function writeTranslations(
  filePath: string,
  sourceFilePath: string,
  results: TranslationResult[],
): void {
  const resultMap = new Map(results.map((r) => [r.id, r.translation]));

  // Parse or create target catalog
  let catalog: GetTextTranslations;
  if (fs.existsSync(filePath)) {
    catalog = po.parse(fs.readFileSync(filePath));
  } else {
    // Bootstrap from source catalog so headers and structure are correct
    const source = po.parse(fs.readFileSync(sourceFilePath));
    catalog = {
      charset: source.charset,
      headers: { ...source.headers },
      translations: {},
    };
  }

  for (const result of results) {
    // Resolve ctx and msgid from the compound id
    const sepIdx = result.id.indexOf("\x04");
    const ctx = sepIdx >= 0 ? result.id.slice(0, sepIdx) : "";
    const msgid = sepIdx >= 0 ? result.id.slice(sepIdx + 1) : result.id;

    if (!catalog.translations[ctx]) catalog.translations[ctx] = {};

    const existing = catalog.translations[ctx][msgid];
    // Build comments without the fuzzy flag (clear it for newly translated strings)
    const { flag: _flag, ...commentsWithoutFlag } = existing?.comments ?? {};
    catalog.translations[ctx][msgid] = {
      ...(existing ?? { msgid }),
      msgstr: [resultMap.get(result.id) ?? ""],
      comments: commentsWithoutFlag,
    };
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, po.compile(catalog));
}
