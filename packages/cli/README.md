# @p6t/cli

LLM-powered translation pipeline CLI for p6t.

## Commands

| Command | Description |
|---|---|
| `p6t init` | Scaffold `i18n.json` and context files; optionally drafts them with an LLM |
| `p6t translate` | Translate missing strings in FormatJS or experimental Lingui catalogs using an LLM |
| `p6t push` | Push translations to p6t web for human review _(coming soon)_ |
| `p6t pull` | Pull confirmed translations from p6t web _(coming soon)_ |

## Quick start

```bash
# 1. Install
pnpm add -D @p6t/cli

# 2. Initialise — creates i18n.json and context files
pnpm exec p6t init

# 3. Extract strings (Lingui)
pnpm exec lingui extract

# 4. Seed/review target glossaries, then translate
pnpm exec p6t translate

# 5. Review target catalogs, then compile (Lingui)
pnpm exec lingui compile
```

For FormatJS, use `react-intl` in React or `@formatjs/intl` without React; both use `format: "react-intl"` and extracted JSON catalog paths in `i18n.json`.

## Agent / CI output

`p6t translate` supports:

- `--quiet` / `-q`: per-file summaries and diagnostics only.
- `--no-progress`: disable interactive progress; it is also disabled automatically when stdout is not a TTY.
- `--json`: a single JSON object on stdout, with no progress or raw responses (even with `--verbose`). Adapter diagnostics may still appear on stderr.

The JSON contains `files` and top-level fatal/setup `errors`. Each file has `locale`, `sourcePath`, `targetPath`, `pending`, `translated`, `missing`, `failed`, `removed`, and an `errors` array. Counts describe this run, including zero-count up-to-date files. `failed` counts strings in failed groups; `missing` counts strings omitted by the model. Incomplete translation exits nonzero; coverage tests and target-language review are still required.

## Configuration — `i18n.json`

```json
{
  "$schema": "https://p6t.dev/schema/i18n.json",
  "version": 1,
  "locale": {
    "source": "en",
    "targets": ["de", "fr", "es"]
  },
  "provider": {
    "id": "openai",
    "model": "gpt-4o"
  },
  "context": {
    "description": "i18n/description.md",
    "styleGuide": "i18n/{locale}/style-guide.md",
    "glossary": "i18n/{locale}/glossary.json"
  }
}
```

### `locale`

| Field | Description |
|---|---|
| `source` | Locale your source strings are written in |
| `targets` | Locales to translate into |

### `provider`

| Field | Description |
|---|---|
| `id` | `openai` \| `anthropic` \| `google` \| `mistral` \| `ollama` \| `openrouter` |
| `model` | Model name (e.g. `gpt-4o`, `claude-sonnet-4-5`) |
| `prompt` | Optional system prompt override |
| `baseUrl` | Optional API base URL override |

### `context`

Paths to the translation context files (all optional — omitting a file means that context is skipped).
`{locale}` in a path is replaced with the target locale at runtime.

### `projectId` _(optional)_

Ties this project to a p6t web project. Required for `push` and `pull` once web integration ships.

## Environment variables

| Variable | Provider |
|---|---|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GOOGLE_GENERATIVE_AI_API_KEY` or `GOOGLE_API_KEY` | Google |
| `MISTRAL_API_KEY` | Mistral |
| `OPENROUTER_API_KEY` | OpenRouter |
| `P6T_API_KEY` | p6t web (push/pull) |

Ollama requires no API key — set `provider.baseUrl` if your Ollama server is not on `localhost:11434`.

Current source loads env files from the working directory with precedence **shell → `.env.local` → `.env`**. Published `0.1.0` has no env-file loader: export credentials or use Node 22's explicit loader, e.g. `node --env-file=.env.local ./node_modules/@p6t/cli/dist/index.js translate`. Keep credentials ignored and out of browser bundles.

## Context files

`p6t init` creates these files. Commit them. They are sent as context on every LLM translation call.

### `i18n/description.md`

Plain English description of your project for translators: what it does, who uses it, industry/domain, vocabulary notes. One file shared across all locales.

### `i18n/{locale}/style-guide.md`

Per-locale rules for tone, formality (formal/informal), brand voice, punctuation, and number/date formatting.

### `i18n/{locale}/glossary.json`

Flat JSON mapping source terms to their required target translations:

```json
{
  "checkout": "Kasse",
  "dashboard": "Dashboard"
}
```

The CLI instructs the LLM to use these exact translations whenever the terms appear.

## Lingui catalog discovery

The CLI reads your `lingui.config.*` (or `package.json` `"lingui"` key) via `@lingui/conf` to find catalog paths. No duplication needed in `i18n.json`.

## Translation behaviour

- **Incremental:** only strings with an empty or fuzzy `msgstr` are sent to the LLM. Existing translations are never overwritten.
- **Batched:** strings are sent in batches of 200 (configurable internally). The LLM receives all context on every batch.
- **Format:** strings are serialised in a compact `---`-delimited format. The LLM is instructed to maintain ICU message syntax and produce the correct plural categories for each target locale.

## Build

```bash
pnpm build       # tsup → dist/index.js (ESM, shebang included)
pnpm build:dev   # tsup --watch
pnpm typecheck   # tsc --noEmit
```

Requires Node 22+. No other runtime needed.
