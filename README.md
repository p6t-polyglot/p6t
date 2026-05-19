# p6t (polyglot)

AI-powered auto-translation CLI for React apps. Works with **react-intl** (default) and **Lingui** (experimental). Uses your own LLM API key — no external service required.

## Packages

| Package | Description | Status |
|---|---|---|
| [`@p6t/config`](./packages/config) | Config schema and shared types (`i18n.json`, `TranslationUnit`, `TranslationResult`) | stable |
| [`@p6t/cli`](./packages/cli) | Developer CLI — `p6t init`, `p6t translate`, push/pull | v0 |

## Toolchain

| Tool | Role |
|---|---|
| pnpm | Package manager (workspaces) |
| Turborepo | Task orchestration and caching |
| TypeScript | Language (strict mode throughout) |
| tsup | Build tool for `packages/*` |
| Bun | Compile-only — produces the `@p6t/cli` binary |
| Changesets | Versioning and changelog |

## Getting started

```bash
pnpm install
pnpm build
```

## Repository structure

```
.
├── apps/
│   └── docs/                   # Nextra documentation site
│
├── packages/
│   ├── config/                 # @p6t/config — config schema and shared types
│   └── cli/                    # @p6t/cli — developer CLI
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Translation pipeline

`p6t translate` sits between the extraction step and the compile step of whichever library you use:

```bash
# react-intl
formatjs extract && p6t translate && formatjs compile-folder

# Lingui (experimental)
lingui extract && p6t translate && lingui compile
```

`p6t translate` reads untranslated strings from extracted catalogs, sends them to an LLM (OpenAI, Anthropic, Google, Mistral, Ollama, or OpenRouter), and writes the results back. It never re-translates strings that are already translated.

Translation quality is driven by three committed context files created by `p6t init`:

| File | Purpose |
|---|---|
| `i18n/description.md` | Project description for translators — domain, users, vocabulary |
| `i18n/{locale}/style-guide.md` | Per-locale tone, formality, and brand voice rules |
| `i18n/{locale}/glossary.json` | Source → target term mapping for key vocabulary |

## Versioning and publishing

This repo uses [Changesets](https://github.com/changesets/changesets).

```bash
pnpm changeset          # author a changeset
pnpm changeset version  # bump versions + update CHANGELOGs
pnpm changeset publish  # publish to npm
```

`@p6t/config` and `@p6t/cli` are published to npm.
