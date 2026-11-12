# react-intl / FormatJS integration

**The catalog format is FormatJS, not React.** Use `react-intl` for React and `@formatjs/intl` for plain JavaScript/TypeScript. The latter provides `defineMessages`, `createIntl`, and `intl.formatMessage` without React; p6t's `format: "react-intl"` works unchanged. A Vite/`tsc`/`tsx`/Vitest app does not need React or a compiler plugin to translate.

Reuse a working setup. For a new one, use inline source messages, generated IDs, rich extracted catalogs, and separately compiled runtime catalogs. Examples assume English source and German/French targets; adapt to the agreed locales and actual source directories.

## Dependencies and generated-ID strategy

```sh
# React only:
pnpm add react-intl
# Non-React instead:
pnpm add @formatjs/intl
# Both:
pnpm add -D @formatjs/cli
```

Choose the runtime dependency matching the app; the two install lines are alternatives. Keep the repo's linter; ESLint is optional (see below).

**Identity:** FormatJS hashes the source text **and the description** with the standard generated-ID pattern. Same text with different descriptions produces different IDs; same text and description intentionally produces one message. Empty and absent descriptions are equivalent. Descriptions are identity-bearing, unlike Lingui's translator `comment`.

The extractor writes catalog IDs but does not inject them into application code. Choose one complete path:

- **Transform:** use the same ID pattern in extraction and every runtime execution path, including tests/scripts. Appropriate when an existing compiler can cover all paths.
- **No transform:** read [formatjs-no-transform.md](formatjs-no-transform.md) when `tsc`, `tsx`, Vite, Vitest, or another split pipeline cannot share a transform. Generate a source-text-plus-description → ID map from extraction and resolve descriptors before formatting. Keep generated IDs; hand-written semantic IDs are not the fallback.

### Existing SWC/Babel pipeline

For Next.js using SWC:

```sh
pnpm add -D @swc/plugin-formatjs
```

Merge into the existing Next.js configuration, rather than replacing it:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    swcPlugins: [
      ['@swc/plugin-formatjs', {
        idInterpolationPattern: '[sha512:contenthash:base64:6]',
        ast: true,
      }],
    ],
  },
}

export default nextConfig
```

Match the SWC plugin to the framework's bundled compiler. Verify both dev and production builds. If the repo uses Babel or a different bundler, keep its pipeline and use the corresponding FormatJS transform. If coverage would require competing compilers, choose the no-transform path instead. Tests rendering ID-less messages need either the matching transform or map resolver too.

## Catalogs and scripts

```text
i18n/
  en.json                 # extracted source descriptors and metadata
  de.json                 # translated descriptors written by p6t
  fr.json
  compiled/
    en.json               # runtime messages, compiled to AST
    de.json
    fr.json
```

Set p6t's catalog template to `i18n/{locale}.json`, never `i18n/compiled/{locale}.json`. The default FormatJS extraction format retains `defaultMessage`, `description`, and location metadata.

Target entries written by p6t also contain `defaultMessage` and may include `_p6t_source` / `_p6t_description` metadata. Do not assume an existing flat `id: "translation"` target catalog is interchangeable: inspect it, preserve its translations, and agree on conversion before running p6t.

Add or adapt scripts:

```json
{
  "scripts": {
    "i18n:extract": "formatjs extract 'src/**/*.{ts,tsx}' --ignore='**/*.d.ts' --out-file i18n/en.json --id-interpolation-pattern '[sha512:contenthash:base64:6]' --extract-source-location --throws",
    "i18n:compile": "formatjs compile-folder i18n i18n/compiled --ast",
    "i18n:translate": "p6t translate"
  }
}
```

**Change the extraction glob to the actual code layout.** A root `app/` directory or shared workspace package is not covered by `src/**/*`. Quote globs and include every intended source location before allowing stale-entry pruning. Keep context/glossary JSON out of the top-level folder of locale catalogs.

For the no-transform path, also preserve source whitespace and generate the ID map as shown in its recipe. Keep that map under `i18n/generated/`, not beside locale JSON consumed by `compile-folder`.

`--extract-source-location` retains metadata for p6t's component-level grouping. Inspect the generated descriptors and p6t output: if references are still reported missing, investigate compatibility between the extractor's metadata shape and the adapter instead of claiming the flag alone fixed grouping.

`compile-folder --ast` compiles the locale catalogs and checks ICU syntax. Do not use error-skipping options to obtain an apparently successful integration. Run the [catalog checks](catalog-tests.md); compilation alone does not prove target coverage. Seed glossaries before translation, then review target catalogs before compilation; keep AI translation and review separate from routine builds.

## Locale helpers and compiled messages

Keep one supported-locale list, default locale, and runtime locale validator. Validate route, host/query, document, cookie, and profile values before loading catalogs. Use an explicit loader map so arbitrary input cannot become an import path:

```ts
// lib/messages.ts; Locale comes from the application's locale model.
import type { IntlConfig } from '@formatjs/intl' // Use 'react-intl' in a React app.
import type { Locale } from './locales'

type Messages = NonNullable<IntlConfig['messages']>

const loaders = {
  en: async () => (await import('../i18n/compiled/en.json')).default,
  de: async () => (await import('../i18n/compiled/de.json')).default,
  fr: async () => (await import('../i18n/compiled/fr.json')).default,
} satisfies Record<Locale, () => Promise<unknown>>

export async function getMessages(locale: Locale): Promise<Messages> {
  return await loaders[locale]() as Messages
}
```

The type assertion is at the generated-JSON boundary: successful compilation establishes the message format. Keep that check in the workflow. Use the installed library's messages type (`react-intl` also exports `IntlConfig`) rather than `Record<string, unknown>`. Ordinarily load only the selected locale's runtime catalog.

### Single-file / CSP-restricted delivery

For an MCP Apps widget, browser extension, or iframe that ships as one HTML document and cannot fetch or split catalogs, **inline every supported compiled catalog**. Use static imports and an allowlisted locale → catalog object; select only the active catalog for its formatter. Configure bundling so these imports become embedded data, not separate chunks or JSON requests, and verify the built HTML under its actual CSP/offline constraints. Do not copy the dynamic loader above into this deployment shape.

The delivered resource URI/content hash must change when any inlined catalog changes (as it does for code). Hash the final HTML/bundle including catalogs, or version its resource URI from that content; otherwise hosts/caches can retain stale translations. Include the generated-ID map in that identity when used.

## Plain JS/TS runtime

Use `defineMessages` for statically extractable descriptors, `createIntl` with the selected compiled catalog, and `intl.formatMessage` to format them. See the [complete no-transform example](formatjs-no-transform.md) for ID resolution. Pass a document's stored language to artifact renderers; resolve viewer chrome with its separate client locale. Recreate locale-specific formatters when their owner changes; a shared `createIntlCache()` may be reused.

## React and server/client boundaries

The inline examples below assume the transform path. Without a transform, declare static descriptors and resolve them with `withId` before passing them to React Intl, including on the server (see [formatjs-no-transform.md](formatjs-no-transform.md)).

For client-rendered React, put an `IntlProvider` above the relevant tree with the selected locale, source `defaultLocale`, and compiled messages. Re-render it when locale changes.

In Next.js App Router, use a thin client boundary:

```tsx
'use client'

import { IntlProvider, type IntlConfig } from 'react-intl'
import type { ReactNode } from 'react'

export default function Providers({ locale, messages, children }: {
  locale: string
  messages: NonNullable<IntlConfig['messages']>
  children: ReactNode
}) {
  return (
    <IntlProvider locale={locale} defaultLocale="en" messages={messages}>
      {children}
    </IntlProvider>
  )
}
```

Client Components use `<FormattedMessage>` for elements and `useIntl().formatMessage` for string-valued props, including `aria-label`, `title`, and placeholders. Give each message an intent-rich description; supply IDs via the chosen transform or map resolver.

Server Components cannot consume `IntlProvider` context. For versions exposing `react-intl/server`, use its non-React API:

```tsx
import { createIntl, createIntlCache } from 'react-intl/server'
import { notFound } from 'next/navigation'
import { defaultLocale, isLocale } from '@/lib/locales'
import { getMessages } from '@/lib/messages'

const cache = createIntlCache()

export default async function Page({ params }: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const messages = await getMessages(locale)
  const intl = createIntl({ locale, defaultLocale, messages }, cache)

  return <h1>{intl.formatMessage({
    defaultMessage: 'Welcome back',
    description: 'Dashboard heading after sign-in. Welcomes the user to their home screen.',
  })}</h1>
}
```

Reuse the formatter cache, not a mutable locale-specific formatter across requests. If the installed react-intl version lacks the server export, check its supported server-safe API rather than inventing an import path or making the entire page a Client Component.

Shared descriptors used by Server Components must likewise come from a server-safe module. Keep client hooks out of server utilities. Match the server-selected locale, messages, timezone, and other formatting inputs when hydrating clients.

## Message linting

If the repo uses Biome or another linter and has no ESLint, keep it. Rely on `formatjs extract --throws`, `formatjs compile`/`compile-folder`, and the [catalog-test recipe](catalog-tests.md); do not add ESLint just for FormatJS. Review statically extractable source text and meaningful descriptions too; extraction alone does not enforce that policy.

For an existing ESLint setup, optionally install `eslint-plugin-formatjs` and merge rules rather than replacing its configuration. Example flat-config entry:

```js
import formatjs from 'eslint-plugin-formatjs'

export default [{
  plugins: { formatjs },
  rules: {
    'formatjs/enforce-description': ['error', 'literal'],
    'formatjs/enforce-default-message': ['error', 'literal'],
    'formatjs/no-id': 'error',
    'formatjs/no-invalid-icu': 'error',
    'formatjs/enforce-placeholders': 'error',
    'formatjs/prefer-full-sentence': 'warn',
  },
}]
```

Enable `no-id` only where automatic ID generation is wired. In an existing keyed app, agree on migration/scoping before enabling it globally. Review the installed plugin's recommended preset if using it; do not assume its additional policy choices match the product. Next.js setups with no `next lint` command should invoke the ESLint CLI directly.

## Verify the full path

Declare representative messages, including identical wording with different descriptions. Extract them; confirm distinct IDs and that the runtime transform/map agrees, with descriptions/references preserved. Translate a configured target, review it, run catalog tests, compile all required locales, and render server/client or plain-TS paths as applicable.

Check interpolation, ICU plurals, long text, accessible names, locale switching, and missing-message behavior. Review human translations and stale removals in the diff. Commit source/target catalogs and, by default for this setup, compiled output so deployments need no provider access. Retain a different existing artifact policy if it is already deliberate and working.

## Version-matched references

- [FormatJS CLI](https://formatjs.github.io/docs/tooling/cli/)
- [FormatJS SWC plugin](https://formatjs.github.io/docs/tooling/swc-plugin/)
- [React Intl with Next.js App Router](https://formatjs.github.io/docs/guides/nextjs-app-router/)
- [FormatJS ESLint plugin](https://formatjs.github.io/docs/tooling/linter/)
