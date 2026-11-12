# FormatJS generated IDs without a transform

Use this path when execution spans `tsc`, `tsx`, Vite, Vitest, or other tools without one common transform. It works with `@formatjs/intl` (no React) and with React descriptor consumers. The extractor remains the authority for IDs; the runtime map only looks them up.

## 1. Extract and generate the map

Copy bundled [generate-ids.mjs](scripts/generate-ids.mjs) into the owning package's `scripts/` directory. Adapt its paths and source glob:

```json
{
  "scripts": {
    "i18n:extract": "formatjs extract 'src/**/*.{ts,tsx}' --ignore='**/*.d.ts' --out-file i18n/en.json --id-interpolation-pattern '[sha512:contenthash:base64:6]' --extract-source-location --preserve-whitespace --throws && node scripts/generate-ids.mjs i18n/en.json i18n/generated/ids.json",
    "i18n:translate": "p6t translate",
    "i18n:compile": "formatjs compile-folder i18n i18n/compiled --ast"
  }
}
```

`--preserve-whitespace` keeps catalog source text equal to runtime descriptor text, including multiline messages. Avoid extraction-only text rewrites such as `--flatten`, or they will break exact lookup. Test this against the installed FormatJS version. Keep `generated/ids.json` out of the locale JSON directory's top level so compilation does not mistake it for a catalog.

The map key is always **`defaultMessage + "\0" + (description ?? "")`**, even when description is absent. JSON encodes the separator as `\u0000`. It is not keyed by default message alone. For example:

```json
{
  "Open\u0000Opens the project": "<generated-action-id>",
  "Open\u0000Unresolved ticket status": "<generated-status-id>"
}
```

FormatJS hashes source text and description; its hash-input serialization is owned by FormatJS. This map's NUL-delimited key is our collision-resistant **lookup convention**, not a replacement hash algorithm. Same text + different description → different IDs; same text + same description → one message. Read the extractor's IDs rather than reimplementing its hashing.

## 2. Resolve descriptors before formatting

```ts
// src/i18n.ts; JSON imports must work in each execution path.
import { createIntl, createIntlCache, defineMessages } from '@formatjs/intl'
import generatedIds from '../i18n/generated/ids.json'
import german from '../i18n/compiled/de.json'

type SourceDescriptor = { defaultMessage: string; description?: string }
const ids: Readonly<Record<string, string>> = generatedIds

export function withId<T extends SourceDescriptor>(descriptor: T): T & { id: string } {
  const key = `${descriptor.defaultMessage}\0${descriptor.description ?? ''}`
  const id = ids[key]
  if (!id) throw new Error('Descriptor missing from generated-ID map; run i18n:extract')
  return { ...descriptor, id }
}

// Keep source declarations visible to extraction; these symbols are not catalog keys.
export const projectMessages = defineMessages({
  open: {
    defaultMessage: 'Open',
    description: 'Opens the project',
  },
})

const cache = createIntlCache()
const intl = createIntl({ locale: 'de', defaultLocale: 'en', messages: german }, cache)
const label = intl.formatMessage(withId(projectMessages.open))
```

The single-locale import illustrates formatting, not locale selection; use an allowlisted selected-catalog loader or the single-file inline-catalog branch from [react-intl.md](react-intl.md). Match JSON import syntax/options to the installed Node/TypeScript/bundler versions (native Node ESM may require `with { type: 'json' }`).

Route every ID-less descriptor through this resolver, including shared definitions and tests. For React, pass `withId(descriptor)` to `formatMessage` or spread it into `<FormattedMessage>`; the resolver is not an extraction API, so declare descriptors with `defineMessages`/`defineMessage` or another recognized static form first. Keep source `defaultMessage` and string `description` together; do not replace descriptions with semantic keys. Do not silently fall back to a default-message-only lookup or a hand-written ID.

## 3. Review, test, and commit

1. Extract the full owning package and generate the map.
2. Seed target glossaries, translate explicitly, and review target catalogs before compiling.
3. Run the [catalog-test recipe](catalog-tests.md), then compile and exercise actual runtime descriptors. A descriptor absent from the map must fail a test, not remain hidden by source fallback.
4. Test identical source wording with two different descriptions: extraction must produce two IDs and runtime formatting must select their distinct translations. Also test identical text/description deduplicates and a new unextracted descriptor throws.
5. Commit source/target catalogs, generated map, and compiled catalogs. Deploy/build/test from these committed artifacts without provider access. In CI, re-extract and check for diffs so new descriptors or stale maps cannot bypass coverage tests.
