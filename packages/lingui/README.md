# @p6t/lingui

Lingui adapter for p6t — use this if your app uses [Lingui](https://lingui.dev/) for translation.

> **Status:** Work in progress — API not stable.

## What this package provides

- `LocaleProvider` — Client Component wrapping Lingui's `I18nProvider`; carries locale, messages, and pre-configured Intl formatters to the client tree
- `initLocale(lang)` — server-side initialisation helper (call in Server Component layouts)
- `loadMessages(lang)` — loads compiled Lingui catalog for a given locale
- `useLocale()` — hook exposing `{ locale, formatDate, formatNumber, formatCurrency, ... }`
- Next.js middleware for public-page locale detection and URL-segment routing

## Installation

```bash
pnpm add @p6t/lingui
```

Peer dependencies — install separately:

```bash
pnpm add @lingui/core @lingui/react react react-dom
```

## Usage

> TBD — API is not yet defined.

## Build

```bash
pnpm build   # tsup → dist/ (ESM + CJS)
pnpm dev     # watch mode
```
