# @p6t/cli

Developer CLI for p6t.

> **Status:** Work in progress — commands not yet implemented.

## Planned commands

| Command | Description |
|---|---|
| `p6t extract` | Wraps `fbtee collect` — scans source and outputs `source_strings.json` |
| `p6t push` | Upload extracted strings to a translation provider |
| `p6t pull` | Download completed translations from a provider |
| `p6t check` | Report translation coverage (missing keys, untranslated strings) |
| `p6t init` | Initialise p6t config in a project |

## Distribution

The CLI is compiled to a single self-contained binary using `bun build --compile`. No Node.js required on end-user machines. The binary is published as part of the `@p6t/cli` npm package.

Bun is used only as a compiler — not as the development runtime. Contributors work in the same Node/pnpm environment as the rest of the monorepo.

## Installation

> TBD — not yet published.

```bash
# npm (global)
npm install -g @p6t/cli

# or run without installing (TBD)
npx @p6t/cli
```

## Build

```bash
pnpm build       # bun build --compile → dist/p6t binary
pnpm build:dev   # tsup → dist/ (for development/testing)
```
