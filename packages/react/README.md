# @p6t/react

React SDK for p6t. This is the package most consumers will install.

> **Status:** Work in progress — API not stable.

## What this package provides

- `<TranslationProvider>` — context provider for locale and translation config
- `<T>` — thin wrapper for common `<fbt>` patterns
- `useTranslation()` — hook for translating strings
- `useLocale()` — hook for reading and switching the active locale

## How fbtee fits in

This package uses `<fbt>` and `<fbt:param>` JSX components from [fbtee](https://github.com/nkzw-tech/fbtee). These are compiled at build time by the consuming app's Babel config — **not** by this package's own build. The fbtee Babel transform must be configured in the app (e.g. `apps/web/babel.config.js`).

## Installation

```bash
pnpm add @p6t/react
```

React and react-dom are peer dependencies — install them separately.

## Usage

> TBD — API is not yet defined.

## Build

```bash
pnpm build   # tsup → dist/ (ESM + CJS)
pnpm dev     # watch mode
```
