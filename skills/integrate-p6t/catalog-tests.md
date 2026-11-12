# Catalog checks without an ESLint dependency

Use the repo's existing test runner/linter. Biome or another linter is fine: `formatjs extract --throws`, catalog tests, and `formatjs compile` provide independent extraction, coverage, and ICU checks. They do not automatically enforce meaningful descriptions; review that source policy as well.

## Ready-made check

Copy bundled [check-catalogs.mjs](scripts/check-catalogs.mjs) into the owning package's `scripts/` directory and install its parser there:

```sh
pnpm add -D @formatjs/icu-messageformat-parser
```

```json
{
  "scripts": {
    "i18n:check": "node scripts/check-catalogs.mjs i18n/en.json i18n/generated/ids.json i18n/de.json i18n/fr.json"
  }
}
```

List every required target explicitly (or derive them from the supported-locale source of truth). Pass `-` instead of the map path for a transform-based setup. Run checks **after complete extraction and translation review, before compilation**. Include `i18n:check` in the existing test/CI workflow; no ESLint installation is needed.

The script fails unless:

- Every source ID has a nonempty target `defaultMessage`.
- Targets have exactly the source IDs: no missing or target-only/stale IDs.
- Source and target ICU parse; placeholder names and kinds (including tags and nested branches) match. Locale-specific plural categories and placeholder reordering are allowed.
- Every source ID has the correct generated-ID map entry, with no stale map entries (when a map is used).
- Every map key includes the NUL description separator, including descriptors with no description.

These checks prove structure/coverage, not translation quality. Review domain vocabulary and natural language before compiling.

## Runtime and extraction tests

In the existing runner, add an extraction fixture using real `defineMessages` from `@formatjs/intl` (or React Intl):

```ts
const messages = defineMessages({
  action: { defaultMessage: 'Open', description: 'Opens the project' },
  status: { defaultMessage: 'Open', description: 'Unresolved ticket status' },
  sameAction: { defaultMessage: 'Open', description: 'Opens the project' },
})
```

Extract with `--id-interpolation-pattern '[sha512:contenthash:base64:6]' --throws`. Assert two IDs: `action` and `status` differ; `sameAction` shares `action`'s identity. Generate the map, compile distinct reviewed target strings, and assert that runtime formatting distinguishes the two meanings. Exercise real app descriptors through `withId` and test that an unextracted descriptor throws. This catches missing map entries even when catalog-to-map checks pass for an outdated extraction.

CI should re-extract/generate, run checks, compile, and reject diffs in committed catalogs/map/compiled output. Keep extraction globs separate from test-only fixtures; a passing catalog test against incomplete extraction is not coverage.
