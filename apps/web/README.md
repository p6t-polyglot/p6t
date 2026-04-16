# apps/web

The hosted translator interface — a Next.js app used by human translators to review and manage translations.

Also serves as the primary reference implementation for fbtee + Next.js integration.

> **Status:** Work in progress.

## Tech

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- fbtee (via `@nkzw/babel-preset-fbtee`)
- `@p6t/react` and `@p6t/core` from this monorepo

## fbtee setup

`babel.config.js` at the app root disables Next.js's SWC compiler and enables the fbtee Babel preset. This is required for `<fbt>` JSX components to be compiled correctly.

```js
// babel.config.js
module.exports = {
  presets: ['@nkzw/babel-preset-fbtee'],
};
```

## Translation pipeline

String collection runs here, pointing at all source including consumed packages:

```bash
# Collect strings from source → source_strings.json
pnpm fbtee:collect

# Compile translations → runtime payload
pnpm fbtee:translate
```

Run `fbtee:collect` before sending strings to a translation provider. Run `fbtee:translate` after pulling translations back.

## Development

```bash
pnpm dev    # start Next.js dev server
pnpm build  # production build
```

## Deployment

Deployed to Vercel (Node runtime). This app is private and not published to npm.
