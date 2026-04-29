import fs from 'node:fs'
import { resolveContextPath } from '../config/loader.ts'
import type { Config } from '../config/schema.ts'

export interface TranslationContext {
  /** Contents of description.md, or undefined if file doesn't exist. */
  description: string | undefined
  /** Contents of the locale's style-guide.md, or undefined. */
  styleGuide: string | undefined
  /** Parsed glossary entries (source → target), or empty if file doesn't exist. */
  glossary: Record<string, string>
}

function readFileSafe(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return undefined
  }
}

function readGlossary(filePath: string): Record<string, string> {
  const raw = readFileSafe(filePath)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      // Accept only string values; silently drop anything else
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).flatMap(([k, v]) =>
          typeof v === 'string' ? [[k, v]] : [],
        ),
      )
    }
  } catch {
    // Malformed JSON — treat as empty
  }
  return {}
}

export function loadContext(
  config: Config,
  targetLocale: string,
  configDir: string,
): TranslationContext {
  const descriptionPath = resolveContextPath(
    config.context.description,
    targetLocale,
    configDir,
  )
  const styleGuidePath = resolveContextPath(
    config.context.styleGuide,
    targetLocale,
    configDir,
  )
  const glossaryPath = resolveContextPath(
    config.context.glossary,
    targetLocale,
    configDir,
  )

  return {
    description: readFileSafe(descriptionPath),
    styleGuide: readFileSafe(styleGuidePath),
    glossary: readGlossary(glossaryPath),
  }
}

/** Format glossary as a readable source → target list for LLM prompts. */
export function formatGlossary(glossary: Record<string, string>): string {
  return Object.entries(glossary)
    .map(([source, target]) => `${source} → ${target}`)
    .join('\n')
}
