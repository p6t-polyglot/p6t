/**
 * Zod runtime schema for i18n.json.
 * The canonical JSON Schema is published at https://p6t.dev/schema/i18n.json
 * (apps/docs/public/schema/i18n.json). Keep both in sync when adding fields.
 */
import { z } from 'zod'

export const ProviderIdSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'ollama',
  'openrouter',
  'mistral',
])

export const ProviderSchema = z.object({
  id: ProviderIdSchema,
  model: z.string(),
  prompt: z.string().optional(),
  baseUrl: z.string().optional(),
})

export const LocaleSchema = z.object({
  source: z.string(),
  targets: z.array(z.string()).min(1),
})

export const ContextSchema = z.object({
  description: z.string().default('i18n/description.md'),
  styleGuide: z.string().default('i18n/{locale}/style-guide.md'),
  glossary: z.string().default('i18n/{locale}/glossary.json'),
})

export const CatalogSchema = z.object({
  path: z.string(),
})

export const ConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(1),
  format: z.enum(['lingui', 'react-intl']).optional(),
  locale: LocaleSchema,
  provider: ProviderSchema,
  context: ContextSchema.default({}),
  projectId: z.string().optional(),
  catalogs: z.array(CatalogSchema).optional(),
})

export type Config = z.infer<typeof ConfigSchema>
export type ProviderId = z.infer<typeof ProviderIdSchema>
export type Provider = z.infer<typeof ProviderSchema>
export type Locale = z.infer<typeof LocaleSchema>
export type Context = z.infer<typeof ContextSchema>
export type Catalog = z.infer<typeof CatalogSchema>
