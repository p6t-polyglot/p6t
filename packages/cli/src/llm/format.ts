import type { TranslationUnit, TranslationResult } from '@p6t/config'
import type { OrphanedTranslation } from '../catalog/adapter.ts'

const BLOCK_SEP = '\n---\n'

/**
 * Serialise a batch of translation units into the compact prompt format.
 */
export function serialiseUnits(units: TranslationUnit[]): string {
  const blocks = units.map((unit) => {
    const lines: string[] = [`id: ${unit.id}`, `source: ${unit.source}`]
    if (unit.sourcePlural) lines.push(`source_plural: ${unit.sourcePlural}`)
    if (unit.context) lines.push(`context: ${unit.context}`)
    if (unit.references?.length) {
      lines.push(`ref: ${unit.references.join(', ')}`)
    }
    return lines.join('\n')
  })
  return '---\n' + blocks.join(BLOCK_SEP) + '\n---'
}

/**
 * Serialise orphaned translations for the system prompt style-reference section.
 *
 * Example output:
 *   ---
 *   id: old.checkout.label
 *   source: Submit order
 *   translation: Bestellung abschicken
 *   ---
 */
export function serialiseOrphans(orphans: OrphanedTranslation[]): string {
  const blocks = orphans.map((o) => {
    const lines: string[] = [`id: ${o.id}`]
    if (o.source) lines.push(`source: ${o.source}`)
    lines.push(`translation: ${o.translation}`)
    if (o.context) lines.push(`context: ${o.context}`)
    return lines.join('\n')
  })
  return '---\n' + blocks.join(BLOCK_SEP) + '\n---'
}

/**
 * Parse the LLM response back into TranslationResult[].
 *
 * Expected response format per block:
 *   ---
 *   id: cart_item_count
 *   translation: Du hast {count, plural, one {# Artikel} other {# Artikel}}
 *   ---
 *
 * Unrecognised blocks and blocks without both id and translation are silently
 * dropped — the caller decides how to handle gaps (re-try, warn, etc.).
 */
export function parseResults(raw: string): TranslationResult[] {
  // Split on --- delimiters (trim whitespace around each block)
  const blocks = raw
    .split(/\n?---\n?/)
    .map((b) => b.trim())
    .filter(Boolean)

  const results: TranslationResult[] = []

  for (const block of blocks) {
    let id: string | undefined
    const translationLines: string[] = []
    let inTranslation = false

    for (const line of block.split('\n')) {
      if (!inTranslation) {
        const idMatch = /^id:\s*(.+)$/.exec(line)
        if (idMatch) {
          id = idMatch[1].trim()
          continue
        }
        const translationMatch =
          /^translation:\s*(.*)$/.exec(line) ??
          /^target:\s*(.*)$/.exec(line)
        if (translationMatch) {
          translationLines.push(translationMatch[1] ?? '')
          inTranslation = true
          continue
        }
      } else {
        // Continuation lines for multi-line translations (indented)
        translationLines.push(line)
      }
    }

    if (id && translationLines.length > 0) {
      results.push({ id, translation: translationLines.join('\n').trimEnd() })
    }
  }

  return results
}
