import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import type { TranslationContext } from '../context/loader.ts'
import { formatGlossary } from '../context/loader.ts'
import type { TranslationResult } from '@p6t/config'
import type { TranslationGroup, OrphanedTranslation } from '../catalog/adapter.ts'
import { serialiseUnits, serialiseOrphans, parseResults } from './format.ts'

export interface TranslationBatch {
  results: TranslationResult[]
  missing: { id: string; source: string }[]
  /** Raw LLM response text for the last batch (useful for debugging). */
  rawResponse: string | undefined
}

/** The seam for future experimentation — swap implementations freely. */
export interface Translator {
  translate(
    group: TranslationGroup,
    orphans: OrphanedTranslation[],
    sourceLocale: string,
    targetLocale: string,
    ctx: TranslationContext,
  ): Promise<TranslationBatch>
}

const DEFAULT_BATCH_SIZE = 200
const DEFAULT_MAX_ORPHANS = 50

function buildSystemPrompt(
  sourceLocale: string,
  targetLocale: string,
  ctx: TranslationContext,
  orphans: OrphanedTranslation[],
  customPrompt?: string,
): string {
  const sections: string[] = []

  if (customPrompt) {
    sections.push(customPrompt)
  } else {
    sections.push(
      `You are a professional translator. Translate from ${sourceLocale} to ${targetLocale}.`,
    )
  }

  if (ctx.description) {
    sections.push(`## Project description\n${ctx.description.trim()}`)
  }

  if (ctx.styleGuide) {
    sections.push(`## Style guide (${targetLocale})\n${ctx.styleGuide.trim()}`)
  }

  const glossaryText = formatGlossary(ctx.glossary)
  if (glossaryText) {
    sections.push(
      `## Glossary — always use these exact translations\n${glossaryText}`,
    )
  }

  if (orphans.length > 0) {
    sections.push(
      [
        '## Previously translated strings (style reference)',
        'These keys were removed or renamed from the source. Use them to maintain consistent tone and terminology:',
        serialiseOrphans(orphans),
      ].join('\n\n'),
    )
  }

  sections.push(
    [
      '## Instructions',
      '- Return translations in exactly the format shown below.',
      '- Maintain ICU message syntax (plurals, select, variables) unchanged in structure.',
      '- Produce the correct plural categories for the target locale.',
      '- Never add, remove, or rename interpolation variables.',
      '- Never translate the `id` field.',
      '- Output one block per input string, delimited by `---`.',
      '',
      '## Expected output format',
      '---',
      'id: example_key',
      'translation: Translated text goes here',
      '---',
    ].join('\n'),
  )

  return sections.join('\n\n')
}

function buildUserPrompt(
  group: TranslationGroup,
  sourceLocale: string,
  targetLocale: string,
): string {
  const contextLine = group.hasSourceRefs
    ? `These strings all appear in: ${group.sourceFile}\n\n`
    : ''

  return (
    `Translate the following strings from ${sourceLocale} to ${targetLocale}:\n\n` +
    contextLine +
    serialiseUnits(group.units)
  )
}

/** Default implementation using generateText + compact format. */
export class DefaultTranslator implements Translator {
  constructor(
    private readonly model: LanguageModel,
    private readonly customPrompt?: string,
    private readonly batchSize = DEFAULT_BATCH_SIZE,
    private readonly maxOrphans = DEFAULT_MAX_ORPHANS,
  ) {}

  async translate(
    group: TranslationGroup,
    orphans: OrphanedTranslation[],
    sourceLocale: string,
    targetLocale: string,
    ctx: TranslationContext,
  ): Promise<TranslationBatch> {
    if (group.units.length === 0) {
      return { results: [], missing: [], rawResponse: undefined }
    }

    const trimmedOrphans = orphans.slice(0, this.maxOrphans)

    const systemPrompt = buildSystemPrompt(
      sourceLocale,
      targetLocale,
      ctx,
      trimmedOrphans,
      this.customPrompt,
    )
    const results: TranslationResult[] = []
    const missing: { id: string; source: string }[] = []
    let lastRawResponse: string | undefined

    // Process in batches within the group
    for (let i = 0; i < group.units.length; i += this.batchSize) {
      const batchUnits = group.units.slice(i, i + this.batchSize)
      const batchGroup: TranslationGroup = { ...group, units: batchUnits }
      const userPrompt = buildUserPrompt(batchGroup, sourceLocale, targetLocale)

      const { text } = await generateText({
        model: this.model,
        system: systemPrompt,
        prompt: userPrompt,
      })

      lastRawResponse = text
      const batchResults = parseResults(text)
      const returned = new Set(batchResults.map((r) => r.id))

      for (const unit of batchUnits) {
        if (!returned.has(unit.id)) {
          missing.push({ id: unit.id, source: unit.source })
        }
      }

      results.push(...batchResults)
    }

    return { results, missing, rawResponse: lastRawResponse }
  }
}
