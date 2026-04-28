# @p6t/fbtee

fbtee adapter for p6t — use this if your app uses [fbtee](https://github.com/nkzw-tech/fbtee) for translation.

> **Status:** Work in progress — API not stable.

## What this package provides

- `LocaleProvider` — Client Component providing locale and pre-configured Intl formatters to the client tree
- `initLocale(lang)` — server-side initialisation helper (call in Server Component layouts)
- `loadTranslations(lang)` — loads the compiled fbtee translation payload for a given locale
- `useLocale()` — hook exposing `{ locale, formatDate, formatNumber, formatCurrency, ... }`
- Next.js middleware for public-page locale detection and URL-segment routing

Note: fbtee requires a Babel transform in the consuming app (`@nkzw/babel-preset-fbtee`). This package handles the runtime layer only.

## Installation

```bash
pnpm add @p6t/fbtee
```

Peer dependencies — install separately:

```bash
pnpm add fbtee react react-dom
```

## Usage

> TBD — API is not yet defined.

## Build

```bash
pnpm build   # tsup → dist/ (ESM + CJS)
pnpm dev     # watch mode
```
