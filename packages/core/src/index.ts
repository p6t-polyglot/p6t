// @p6t/core — framework-agnostic translation engine

/** A single string that needs translation. */
export interface TranslationUnit {
  /** Stable identifier (msgid, message key, etc.). */
  id: string;
  /** Source text. */
  source: string;
  /** Plural source form, if applicable. */
  sourcePlural?: string;
  /** Translator comment / description / intent. */
  context?: string;
  /** Source file references, e.g. ["src/Cart.tsx:42"]. */
  references?: string[];
}

/** Result returned from a translator. */
export interface TranslationResult {
  id: string;
  translation: string;
}
