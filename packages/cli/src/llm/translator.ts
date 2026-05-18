import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import type { TranslationContext } from '../context/loader.ts'
import { formatGlossary } from '../context/loader.ts'
import type { TranslationUnit, TranslationResult } from '@p6t/core'
import { serialiseUnits, parseResults } from './format.ts'

export interface TranslationBatch {
  results: TranslationResult[]
  missing: TranslationUnit[]
  /** Raw LLM response text for the last batch (useful for debugging). */
  rawResponse: string | undefined
}

/** The seam for future experimentation — swap implementations freely. */
export interface Translator {
  translate(
    units: TranslationUnit[],
    sourceLocale: string,
    targetLocale: string,
    ctx: TranslationContext,
  ): Promise<TranslationBatch>
}

const DEFAULT_BATCH_SIZE = 200

function buildSystemPrompt(
  sourceLocale: string,
  targetLocale: string,
  ctx: TranslationContext,
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
  units: TranslationUnit[],
  sourceLocale: string,
  targetLocale: string,
): string {
  return (
    `Translate the following strings from ${sourceLocale} to ${targetLocale}:\n\n` +
    serialiseUnits(units)
  )
}

/** Default implementation using generateText + compact format. */
export class DefaultTranslator implements Translator {
  constructor(
    private readonly model: LanguageModel,
    private readonly customPrompt?: string,
    private readonly batchSize = DEFAULT_BATCH_SIZE,
  ) {}

  async translate(
    units: TranslationUnit[],
    sourceLocale: string,
    targetLocale: string,
    ctx: TranslationContext,
  ): Promise<TranslationBatch> {
    if (units.length === 0) return { results: [], missing: [], rawResponse: undefined }

    const systemPrompt = buildSystemPrompt(
      sourceLocale,
      targetLocale,
      ctx,
      this.customPrompt,
    )
    const results: TranslationResult[] = []
    const missing: TranslationUnit[] = []
    let lastRawResponse: string | undefined

    // Process in batches
    for (let i = 0; i < units.length; i += this.batchSize) {
      const batch = units.slice(i, i + this.batchSize)
      const userPrompt = buildUserPrompt(batch, sourceLocale, targetLocale)

      const { text } = await generateText({
        model: this.model,
        system: systemPrompt,
        prompt: userPrompt,
      })

      lastRawResponse = text
      const batchResults = parseResults(text)
      const returned = new Set(batchResults.map((r) => r.id))

      for (const unit of batch) {
        if (!returned.has(unit.id)) {
          missing.push(unit)
        }
      }

      results.push(...batchResults)
    }

    return { results, missing, rawResponse: lastRawResponse }
  }
}
