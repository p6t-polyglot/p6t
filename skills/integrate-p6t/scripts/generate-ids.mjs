import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Copy into the owning package's scripts/ directory. Read IDs from extraction;
// this lookup key is not a reimplementation of FormatJS's hash algorithm.
const [sourcePath, outputPath] = process.argv.slice(2)
assert(sourcePath && outputPath, 'Usage: node generate-ids.mjs <source.json> <ids.json>')
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
const ids = Object.create(null)

for (const [id, descriptor] of Object.entries(source)) {
  assert.equal(typeof descriptor.defaultMessage, 'string', `${id}: missing source text`)
  assert(descriptor.description === undefined || typeof descriptor.description === 'string', `${id}: use a string description`)
  const key = `${descriptor.defaultMessage}\0${descriptor.description ?? ''}`
  assert(!Object.hasOwn(ids, key) || ids[key] === id, `${id}: conflicting IDs for the same source text and description`)
  ids[key] = id
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(ids, null, 2)}\n`)
