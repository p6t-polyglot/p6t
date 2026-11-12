import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse, TYPE } from '@formatjs/icu-messageformat-parser'

// Copy into the owning package's scripts/ directory and install the parser there.
const [sourcePath, idsPath, ...targetPaths] = process.argv.slice(2)
assert(sourcePath && idsPath && targetPaths.length > 0, 'Usage: node check-catalogs.mjs <source.json> <ids.json|-> <target.json>...')
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const source = read(sourcePath)
const sourceIds = Object.keys(source).sort()
assert(sourceIds.length > 0, 'Source catalog is empty; check extraction coverage')

if (idsPath !== '-') {
  const ids = read(idsPath)
  assert(Object.keys(ids).every(key => key.includes('\0')), 'Every map key must include the description separator')
  assert.equal(Object.keys(ids).length, sourceIds.length, 'ID map has missing or stale entries')
  for (const [id, descriptor] of Object.entries(source)) {
    const key = `${descriptor.defaultMessage}\0${descriptor.description ?? ''}`
    assert.equal(ids[key], id, `${id}: missing or incorrect generated-ID map entry`)
  }
}

function placeholders(message) {
  const names = new Set()
  function visit(elements) {
    for (const element of elements) {
      if (element.type === TYPE.literal || element.type === TYPE.pound) continue
      const kind = element.type === TYPE.plural ? `${element.type}:${element.pluralType}` : element.type
      names.add(`${kind}:${element.value}`)
      if (element.type === TYPE.select || element.type === TYPE.plural) {
        for (const option of Object.values(element.options)) visit(option.value)
      } else if (element.type === TYPE.tag) visit(element.children)
    }
  }
  visit(parse(message))
  return [...names].sort()
}

for (const targetPath of targetPaths) {
  const target = read(targetPath)
  assert.deepEqual(Object.keys(target).sort(), sourceIds, `${targetPath}: missing or stale IDs`)
  for (const id of sourceIds) {
    const text = target[id].defaultMessage
    assert(typeof text === 'string' && text.trim() !== '', `${targetPath}: ${id} has an empty translation`)
    assert.deepEqual(placeholders(text), placeholders(source[id].defaultMessage), `${targetPath}: ${id} ICU placeholders differ`)
  }
}

console.log(`Catalog checks passed (${sourceIds.length} IDs, ${targetPaths.length} targets)`)
