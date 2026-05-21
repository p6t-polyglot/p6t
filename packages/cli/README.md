# @p6t/cli

LLM-powered translation pipeline CLI for p6t.

## Commands

| Command | Description |
|---|---|
| `p6t init` | Scaffold `i18n.json` and context files; optionally drafts them with an LLM |
| `p6t translate` | Translate missing strings in Lingui catalogs using an LLM |
| `p6t push` | Push translations to p6t web for human review _(coming soon)_ |
| `p6t pull` | Pull confirmed translations from p6t web _(coming soon)_ |

## Quick start

```bash
# 1. Install
npm install -g @p6t/cli

# 2. Initialise — creates i18n.json and context files
p6t init

# 3. Extract strings (Lingui)
lingui extract

# 4. Translate
p6t translate

# 5. Compile (Lingui)
lingui compile
```

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
| `GOOGLE_AI_API_KEY` or `GEMINI_API_KEY` | Google |
| `MISTRAL_API_KEY` | Mistral |
| `OPENROUTER_API_KEY` | OpenRouter |
| `P6T_API_KEY` | p6t web (push/pull) |

Ollama requires no API key — set `provider.baseUrl` if your Ollama server is not on `localhost:11434`.

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
