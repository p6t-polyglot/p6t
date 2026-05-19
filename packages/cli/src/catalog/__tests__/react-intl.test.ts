import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createReactIntlAdapter } from '../react-intl.ts'

describe('createReactIntlAdapter', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p6t-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('groups units by source file when refs exist', () => {
    const sourcePath = path.join(tmpDir, 'en.json')
    fs.writeFileSync(
      sourcePath,
      JSON.stringify({
        w1: {
          defaultMessage: 'Hello',
          file: 'src/page.tsx',
          line: 10,
        },
        w2: {
          defaultMessage: 'World',
          file: 'src/page.tsx',
          line: 20,
        },
        w3: {
          defaultMessage: 'Other',
          file: 'src/other.tsx',
          line: 5,
        },
      }),
    )

    const targetPath = path.join(tmpDir, 'de.json')
    fs.writeFileSync(targetPath, JSON.stringify({}))

    const adapter = createReactIntlAdapter(tmpDir, [{ path: 'en.json' }])
    const pending = adapter.readPendingTranslations(targetPath, sourcePath)

    expect(pending.groups).toHaveLength(2)
    const pageGroup = pending.groups.find((g) => g.sourceFile === 'src/page.tsx')
    const otherGroup = pending.groups.find((g) => g.sourceFile === 'src/other.tsx')

    expect(pageGroup).toBeDefined()
    expect(pageGroup!.units).toHaveLength(2)
    expect(pageGroup!.hasSourceRefs).toBe(true)

    expect(otherGroup).toBeDefined()
    expect(otherGroup!.units).toHaveLength(1)
    expect(otherGroup!.hasSourceRefs).toBe(true)
  })

  it('falls back to catalog path when refs are missing', () => {
    const sourcePath = path.join(tmpDir, 'en.json')
    fs.writeFileSync(
      sourcePath,
      JSON.stringify({
        w1: { defaultMessage: 'Hello' },
        w2: { defaultMessage: 'World' },
      }),
    )

    const targetPath = path.join(tmpDir, 'de.json')
    fs.writeFileSync(targetPath, JSON.stringify({}))

    const adapter = createReactIntlAdapter(tmpDir, [{ path: 'en.json' }])
    const pending = adapter.readPendingTranslations(targetPath, sourcePath)

    expect(pending.groups).toHaveLength(1)
    expect(pending.groups[0].sourceFile).toBe(sourcePath)
    expect(pending.groups[0].hasSourceRefs).toBe(false)
    expect(pending.groups[0].units).toHaveLength(2)
  })

  it('skips already-translated units', () => {
    const sourcePath = path.join(tmpDir, 'en.json')
    fs.writeFileSync(
      sourcePath,
      JSON.stringify({
        w1: { defaultMessage: 'Hello' },
        w2: { defaultMessage: 'World' },
      }),
    )

    const targetPath = path.join(tmpDir, 'de.json')
    fs.writeFileSync(
      targetPath,
      JSON.stringify({
        w1: { defaultMessage: 'Hallo' },
      }),
    )

    const adapter = createReactIntlAdapter(tmpDir, [{ path: 'en.json' }])
    const pending = adapter.readPendingTranslations(targetPath, sourcePath)

    expect(pending.groups[0].units).toHaveLength(1)
    expect(pending.groups[0].units[0].id).toBe('w2')
  })

  it('captures orphans with metadata on stale key removal', () => {
    const sourcePath = path.join(tmpDir, 'en.json')
    fs.writeFileSync(
      sourcePath,
      JSON.stringify({
        kept: { defaultMessage: 'Kept', description: 'D1' },
      }),
    )

    const targetPath = path.join(tmpDir, 'de.json')
    fs.writeFileSync(
      targetPath,
      JSON.stringify({
        kept: { defaultMessage: 'Behalten', _p6t_source: 'Kept', _p6t_description: 'D1' },
        removed: { defaultMessage: 'Entfernt', _p6t_source: 'Removed', _p6t_description: 'D2' },
      }),
    )

    const adapter = createReactIntlAdapter(tmpDir, [{ path: 'en.json' }])
    const orphans = adapter.removeStaleKeys(targetPath, sourcePath)

    expect(orphans).toHaveLength(1)
    expect(orphans[0].id).toBe('removed')
    expect(orphans[0].source).toBe('Removed')
    expect(orphans[0].translation).toBe('Entfernt')
    expect(orphans[0].context).toBe('D2')

    // Target catalog should now only contain 'kept'
    const remaining = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
    expect(Object.keys(remaining)).toEqual(['kept'])
  })

  it('writes translations preserving _p6t metadata', () => {
    const sourcePath = path.join(tmpDir, 'en.json')
    fs.writeFileSync(
      sourcePath,
      JSON.stringify({
        w1: { defaultMessage: 'Hello', description: 'Greeting' },
      }),
    )

    const targetPath = path.join(tmpDir, 'de.json')

    const adapter = createReactIntlAdapter(tmpDir, [{ path: 'en.json' }])
    adapter.writeTranslations(targetPath, sourcePath, [
      { id: 'w1', translation: 'Hallo' },
    ])

    const written = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
    expect(written.w1).toEqual({
      defaultMessage: 'Hallo',
      _p6t_source: 'Hello',
      _p6t_description: 'Greeting',
    })
  })

  it('preserves source catalog order when writing', () => {
    const sourcePath = path.join(tmpDir, 'en.json')
    fs.writeFileSync(
      sourcePath,
      JSON.stringify({
        z: { defaultMessage: 'Z' },
        a: { defaultMessage: 'A' },
        m: { defaultMessage: 'M' },
      }),
    )

    const targetPath = path.join(tmpDir, 'de.json')

    const adapter = createReactIntlAdapter(tmpDir, [{ path: 'en.json' }])
    adapter.writeTranslations(targetPath, sourcePath, [
      { id: 'a', translation: 'A-de' },
      { id: 'm', translation: 'M-de' },
      { id: 'z', translation: 'Z-de' },
    ])

    const written = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
    expect(Object.keys(written)).toEqual(['z', 'a', 'm'])
  })
})
