import * as z from "zod";

export const ProviderIdSchema = z.enum([
  "openai",
  "anthropic",
  "google",
  "ollama",
  "openrouter",
  "mistral",
]);

export const ProviderSchema = z.object({
  id: ProviderIdSchema.describe(
    'LLM provider identifier: "openai", "anthropic", "google", "ollama", "openrouter", "mistral"',
  ),
  model: z
    .string()
    .describe(
      'Model name to use for translation (e.g. "gpt-4o", "claude-sonnet-4-5").',
    ),
  prompt: z
    .string()
    .optional()
    .describe(
      "Optional system prompt override. Replaces the default p6t prompt entirely.",
    ),
  baseUrl: z
    .string()
    .optional()
    .describe(
      "Optional API base URL override. Useful for proxies, local Ollama, or custom endpoints.",
    ),
});

export const LocaleSchema = z.object({
  source: z
    .string()
    .describe(
      'The locale your source strings are written in (e.g. "en", "en-US").',
    ),
  targets: z.array(z.string()).min(1).describe("Locales to translate into."),
});

export const ContextSchema = z.object({
  description: z
    .string()
    .default("i18n/description.md")
    .describe(
      'Path to the project description file (markdown). Shared across all locales. Default: "i18n/description.md".',
    ),
  styleGuide: z
    .string()
    .default("i18n/{locale}/style-guide.md")
    .describe(
      'Path template for the per-locale style guide (markdown). {locale} is replaced with the target locale. Default: "i18n/{locale}/style-guide.md".',
    ),
  glossary: z
    .string()
    .default("i18n/{locale}/glossary.json")
    .describe(
      'Path template for the per-locale glossary (flat JSON object mapping source terms to target translations). {locale} is replaced with the target locale. Default: "i18n/{locale}/glossary.json".',
    ),
});

export const CatalogSchema = z.object({
  path: z
    .string()
    .describe(
      "Path template to catalog files, e.g. 'i18n/{locale}.json' or '<rootDir>/i18n/{locale}/messages.po'.",
    ),
});

export const ConfigSchema = z.object({
  $schema: z
    .string()
    .optional()
    .describe(
      'JSON Schema reference. Set to "https://p6t.dev/schema/i18n.json".',
    ),
  version: z.literal(1).describe("Schema version. Must be 1."),
  format: z
    .enum(["lingui", "react-intl"])
    .optional()
    .describe(
      "Translation library / catalog format. Auto-detected if omitted.",
    ),
  locale: LocaleSchema.describe(
    "Source and target locales for the translation pipeline.",
  ),
  provider: ProviderSchema.describe(
    "LLM provider used for translation. API keys are read from environment variables, never from this file.",
  ),
  context: ContextSchema.default({
    description: "i18n/description.md",
    styleGuide: "i18n/{locale}/style-guide.md",
    glossary: "i18n/{locale}/glossary.json",
  }).describe(
    "Paths to the translation context files sent to the LLM on every call. All paths are relative to the directory containing i18n.json. Use {locale} as a placeholder for the target locale.",
  ),
  projectId: z
    .string()
    .optional()
    .describe(
      "p6t web project identifier. Required for `p6t push` and `p6t pull`. Obtain this from the p6t web app.",
    ),
  catalogs: z
    .array(CatalogSchema)
    .optional()
    .describe(
      "Catalog path templates (required for react-intl; optional for Lingui). Use {locale} as a placeholder.",
    ),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ProviderId = z.infer<typeof ProviderIdSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type Locale = z.infer<typeof LocaleSchema>;
export type Context = z.infer<typeof ContextSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
