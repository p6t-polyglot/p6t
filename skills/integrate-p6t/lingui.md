# Lingui integration (experimental in p6t)

Keep a working Lingui installation. Explain that p6t's Lingui support is experimental before choosing it for a new setup. Match all Lingui package versions and read the setup documentation for the installed major and bundler.

## Dependencies and build integration

For a new React setup:

```sh
pnpm add @lingui/core @lingui/react
pnpm add -D @lingui/cli @lingui/format-po
```

Choose one macro-transform integration that fits the existing build:

- **Babel:** use `@lingui/babel-plugin-lingui-macro` where supported; register it before React Compiler. Older majors may use a different macro setup.
- **Next.js/SWC:** use the compatible `@lingui/swc-plugin` and its documented Next.js configuration. Check compiler compatibility rather than adding Babel unnecessarily.
- **Vite:** use the version-matched `@lingui/vite-plugin` configuration for macro transformation and/or catalog loading. Do not assume a root Babel config is automatically read by the React plugin.

Prove macro expansion in both development and production. Extraction succeeding does not demonstrate that the application's build transforms macros correctly. Do not configure overlapping transforms or replace a working bundler.

## Lingui owns its catalog paths

Example `lingui.config.ts` for a version supporting the PO formatter package:

```ts
import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'de', 'fr'],
  catalogs: [{
    path: '<rootDir>/src/locales/{locale}/messages',
    include: ['<rootDir>/src'],
  }],
  format: formatter(),
})
```

Change `src` to the actual source roots, including shared UI intended for extraction. Lingui catalog templates omit the extension; this produces `messages.po` files and compiled runtime catalogs beside them. Retain comments and source references in PO output.

Use PO catalogs containing source messages, descriptions/comments, and references. Do not replace them with runtime JSON or assume an arbitrary gettext plural format works identically.

Configure p6t with `format: "lingui"` and the same source and target locales. The adapter reads paths from `lingui.config.*` via `@lingui/conf`; do not duplicate them into p6t's `catalogs`. Existing legacy config locations depend on the installed Lingui version; prefer a recognized config file when establishing a new setup. Check advanced templating such as `{name}` against adapter support before promising it works.

## Source-first messages

```tsx
import { Trans } from '@lingui/react/macro'

<Trans comment="Primary action in the profile settings form. Saves all pending edits.">
  Save changes
</Trans>
```

Use imports supported by the installed version. Require an intent-rich `comment` on each message; use named variables and keep full sentences together. Use Lingui plural/select macros for the source language and preserve their ICU structure during translation.

For repeated concepts, share a component or a `msg` descriptor through an ordinary import. Resolve descriptors with the active instance rather than storing translated strings at module scope. `comment` is translator guidance; use semantic `context` when identical source wording needs distinct meanings. Do not introduce manual global translation keys as a reuse mechanism.

## Runtime locale and catalog activation

- Load the selected locale's **compiled** catalog, then activate it on the instance provided to `I18nProvider`.
- In a client-only app, `i18n.load(locale, messages)` followed by `i18n.activate(locale)` establishes the active language. Resolve strings through the provider's instance; React consumers should use `useLingui()` so they update after activation.
- Keep one locale model and selection flow. A custom `LocaleContext` is useful only if it exposes app-specific preference behavior, not as an unrelated second source of truth beside Lingui.
- When switching language, load the new catalog before activation and persist the choice using the agreed URL/profile/cookie policy.
- For SSR/RSC, use the installed version's request-scoped setup and client handoff. Do not activate a mutable global instance per request. Keep server/client locale and catalogs consistent.
- Use active-locale `Intl` formatters for numbers, dates, currencies, and units. Include descriptions for attribute strings and error states, not just `<Trans>` headings.

## Scripts and verification

```json
{
  "scripts": {
    "i18n:extract": "lingui extract",
    "i18n:compile": "lingui compile",
    "i18n:update": "pnpm i18n:extract && pnpm exec p6t translate && pnpm i18n:compile"
  }
}
```

1. Run extraction for all configured locales. Confirm the source PO file contains readable source messages, extracted comments, and file references; inspect the target diffs.
2. Run `p6t translate --locale de` through the local CLI with permission and credentials. The adapter translates missing/empty **or fuzzy** entries, so existing fuzzy wording may be replaced. It removes entries absent from the source; do not run against incomplete extraction output.
3. Compile; verify that runtime imports point to the generated module format expected by the bundler. Choose TypeScript output or compiler strictness flags only if supported by the installed CLI.
4. Check required-message coverage explicitly; fallback or a successful compile can hide missing translations. Inspect p6t warnings and pending entries instead of trusting only its exit code.
5. Render the source and target locale, switch locale, and check plurals, interpolated values, rich text, accessible names, and persistence. For SSR, test concurrent locale isolation and hydration.

Keep PO catalogs and reviewed p6t context in version control. Follow the repo's compiled-artifact policy and ensure deployment can compile/load translations without contacting an LLM. Review drafts with product/native-language expertise as appropriate.

## Version-matched references

- [Lingui installation and build integration](https://lingui.dev/installation)
- [React tutorial](https://lingui.dev/tutorials/react)
- [React Server Components tutorial](https://lingui.dev/tutorials/react-rsc)
- [Configuration](https://lingui.dev/ref/conf)
- [Macros](https://lingui.dev/ref/macro)
