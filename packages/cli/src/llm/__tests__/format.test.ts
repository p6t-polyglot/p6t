import { describe, it, expect } from 'vitest'
import { serialiseUnits, serialiseOrphans, parseResults } from '../format.ts'
import type { TranslationUnit } from '@p6t/config'
import type { OrphanedTranslation } from '../../catalog/adapter.ts'

describe('serialiseUnits', () => {
  it('serialises a single unit with minimal fields', () => {
    const units: TranslationUnit[] = [
      { id: 'hello', source: 'Hello world' },
    ]
    const result = serialiseUnits(units)
    expect(result).toBe('---\nid: hello\nsource: Hello world\n---')
  })

  it('serialises multiple units separated by ---', () => {
    const units: TranslationUnit[] = [
      { id: 'a', source: 'First' },
      { id: 'b', source: 'Second' },
    ]
    const result = serialiseUnits(units)
    expect(result).toBe(
      '---\nid: a\nsource: First\n---\nid: b\nsource: Second\n---',
    )
  })

  it('includes optional fields when present', () => {
    const units: TranslationUnit[] = [
      {
        id: 'items',
        source: 'You have {count} items',
        sourcePlural: 'You have {count} items (plural)',
        context: 'Cart summary',
        references: ['src/Cart.tsx:42'],
      },
    ]
    const result = serialiseUnits(units)
    expect(result).toBe(
      '---\n' +
        'id: items\n' +
        'source: You have {count} items\n' +
        'source_plural: You have {count} items (plural)\n' +
        'context: Cart summary\n' +
        'ref: src/Cart.tsx:42\n' +
        '---',
    )
  })

  it('joins multiple references with comma', () => {
    const units: TranslationUnit[] = [
      {
        id: 'x',
        source: 'X',
        references: ['src/A.tsx:1', 'src/B.tsx:2'],
      },
    ]
    const result = serialiseUnits(units)
    expect(result).toContain('ref: src/A.tsx:1, src/B.tsx:2')
  })
})

describe('serialiseOrphans', () => {
  it('serialises a single orphan', () => {
    const orphans: OrphanedTranslation[] = [
      {
        id: 'old.key',
        source: 'Old text',
        translation: 'Alter Text',
        context: undefined,
      },
    ]
    const result = serialiseOrphans(orphans)
    expect(result).toBe(
      '---\n' + 'id: old.key\n' + 'source: Old text\n' + 'translation: Alter Text\n' + '---',
    )
  })

  it('includes context when present', () => {
    const orphans: OrphanedTranslation[] = [
      {
        id: 'old.key',
        source: 'Submit',
        translation: 'Absenden',
        context: 'Button label',
      },
    ]
    const result = serialiseOrphans(orphans)
    expect(result).toContain('context: Button label')
  })

  it('handles missing source gracefully', () => {
    const orphans: OrphanedTranslation[] = [
      {
        id: 'old.key',
        source: undefined,
        translation: 'Übersetzung',
        context: undefined,
      },
    ]
    const result = serialiseOrphans(orphans)
    expect(result).toBe(
      '---\n' + 'id: old.key\n' + 'translation: Übersetzung\n' + '---',
    )
  })
})

describe('parseResults', () => {
  it('parses a single translation block', () => {
    const raw = '---\nid: hello\ntranslation: Hallo\n---'
    const results = parseResults(raw)
    expect(results).toEqual([{ id: 'hello', translation: 'Hallo' }])
  })

  it('parses multiple blocks', () => {
    const raw =
      '---\nid: a\ntranslation: Erste\n---\n---\nid: b\ntranslation: Zweite\n---'
    const results = parseResults(raw)
    expect(results).toEqual([
      { id: 'a', translation: 'Erste' },
      { id: 'b', translation: 'Zweite' },
    ])
  })

  it('handles multi-line translations', () => {
    const raw =
      '---\nid: long\ntranslation: Line one\nLine two\nLine three\n---'
    const results = parseResults(raw)
    expect(results).toEqual([
      { id: 'long', translation: 'Line one\nLine two\nLine three' },
    ])
  })

  it('drops blocks without id', () => {
    const raw = '---\ntranslation: No ID here\n---'
    const results = parseResults(raw)
    expect(results).toEqual([])
  })

  it('drops blocks without translation', () => {
    const raw = '---\nid: missing-translation\n---'
    const results = parseResults(raw)
    expect(results).toEqual([])
  })

  it('accepts "target:" as alias for "translation:"', () => {
    const raw = '---\nid: alias\ntarget: Ziel\n---'
    const results = parseResults(raw)
    expect(results).toEqual([{ id: 'alias', translation: 'Ziel' }])
  })

  it('ignores surrounding whitespace', () => {
    const raw = '  ---\nid: spaced\ntranslation: Text\n---  '
    const results = parseResults(raw)
    expect(results).toEqual([{ id: 'spaced', translation: 'Text' }])
  })
})
