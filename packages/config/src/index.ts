// @p6t/config — configuration schema and shared types for p6t

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

// Re-export config schema and types so all packages share a single source of truth.
export {
  ProviderIdSchema,
  ProviderSchema,
  LocaleSchema,
  ContextSchema,
  CatalogSchema,
  ConfigSchema,
} from "./config";

export type {
  Config,
  ProviderId,
  Provider,
  Locale,
  Context,
  Catalog,
} from "./config";
