# p6t configuration and operation

## Architecture and boundaries

- `@p6t/cli` reads extracted catalogs, sends missing messages and translation context to the selected LLM provider, and writes translations back.
- `@p6t/config` provides the configuration schema and shared translation types. Applications do not need it as a React runtime dependency.
- The i18n library owns extraction, compilation, runtime formatting, and any React integration. `@formatjs/intl` needs no React and uses the same `react-intl` catalog adapter. p6t fits between extraction and compilation; it does not implement locale routing or a runtime provider.
- The standalone workflow needs no p6t account or web service. `push`/`pull` are placeholders for a planned review layer, not usable integration steps. Do not require `projectId` or `P6T_API_KEY` for translation.

Use a compatible Node.js runtime (Node 22 is the CLI's documented baseline), and check the selected i18n toolchain's own requirements.

## Install and initialize

```sh
pnpm add -D @p6t/cli
pnpm i18n:extract
pnpm exec p6t init
```

Run from the application's directory. Init asks for source/target locales, provider/model, catalog format, the react-intl catalog path, and whether to draft context with the LLM. Extract source messages first so drafting can use the actual UI. Drafting can also use the README and existing translations; obtain consent to send that material to the provider.

**Rerunning init is not a safe merge.** It rebuilds `i18n.json`; optional fields and custom context paths may be lost. LLM drafting can overwrite context files. Inspect the existing setup and edit/merge it manually unless regenerating those files is intended. Without an interactive terminal, author the configuration and context directly rather than guessing CLI flags.

## Configuration

**Non-interactive setup:** create this `i18n.json` and the context files directly; `p6t init` is interactive, not an unattended prerequisite. Example for FormatJS (`react-intl` or non-React `@formatjs/intl`); replace locales, paths, and the placeholder model with the agreed values:

```json
{
  "$schema": "https://p6t.dev/schema/i18n.json",
  "version": 1,
  "format": "react-intl",
  "locale": {
    "source": "en",
    "targets": ["de", "fr"]
  },
  "catalogs": [{ "path": "i18n/{locale}.json" }],
  "provider": {
    "id": "openai",
    "model": "<chosen-model>"
  },
  "context": {
    "description": "i18n/description.md",
    "styleGuide": "i18n/{locale}/style-guide.md",
    "glossary": "i18n/{locale}/glossary.json"
  }
}
```

- `version` is `1`; `locale.targets` must include at least one target. Do not include the source as a translation target.
- Set `format` explicitly: `react-intl` or `lingui`. Do not rely on format auto-detection for a react-intl setup.
- react-intl requires `catalogs`, with one or more `{locale}` path templates. Paths are relative to the directory containing `i18n.json`; do not use Lingui's `<rootDir>` token here.
- For Lingui, set `format: "lingui"` and normally omit p6t's `catalogs`; the adapter reads paths from the Lingui configuration.
- `provider.id` and `provider.model` are required. Choose a real model supported by that provider, not a hard-coded recommendation presumed current forever.
- Optional `provider.baseUrl` overrides supported provider endpoints, such as a proxy or Ollama. The OpenRouter implementation does not consume this override; check compatibility before promising a custom endpoint.
- Optional `provider.prompt` replaces the default translator role text. Prefer context files for product-specific guidance rather than replacing the base instruction.
- `context` defaults to the paths above; missing context files are skipped. Missing context is not a reason to claim translation quality has been established.
- `projectId` is reserved for web integration; leave it out unless an implemented workflow requires it.

The CLI finds `i18n.json` by walking upward from the working directory. Catalog/context paths use the config directory, but environment files use the working directory. In a monorepo, prefer explicit workspace commands from the app directory to avoid finding the wrong config or credentials.

### Monorepo: one config per owning package

Ownership, not React app count, sets the boundary. If one package renders domain artifacts and another owns viewer chrome, give each its own config, source extraction, catalogs, and runtime formatter. Their language sources may differ even when vocabulary is shared.

```text
i18n-context/
  description.md
  de/style-guide.md
  de/glossary.json
packages/
  artifacts/
    i18n.json
    src/                     # artifact descriptors only
    i18n/{en,de}.json
  viewer/
    i18n.json
    src/                     # viewer-chrome descriptors only
    i18n/{en,de}.json
```

Use the config template above in **both** packages, with their own `catalogs: [{ "path": "i18n/{locale}.json" }]` and `targets: ["de"]`. Reference shared root context relative to each config:

```json
{
  "context": {
    "description": "../../i18n-context/description.md",
    "styleGuide": "../../i18n-context/{locale}/style-guide.md",
    "glossary": "../../i18n-context/{locale}/glossary.json"
  }
}
```

Keep extraction globs package-local and ownership-specific: e.g. artifact `src/**/*.ts`, viewer `src/**/*.{ts,tsx}`. Include genuinely shared descriptor modules in their owning package's extraction, rather than sweeping every workspace into both catalogs. Use package-specific context files where domain meanings or style differ; p6t reads one file per configured context field, not an implicit merge.

Give each package `i18n:extract`, `i18n:translate` (`p6t translate --quiet`), `i18n:check`, and `i18n:compile` scripts. Install the CLI in the owning packages or ensure the workspace makes its executable available. Root orchestration uses `pnpm -r --if-present i18n:*` **per named task**, not a literal wildcard:

```json
{
  "scripts": {
    "i18n:extract": "pnpm -r --if-present i18n:extract",
    "i18n:translate": "pnpm -r --if-present i18n:translate",
    "i18n:check": "pnpm -r --if-present i18n:check",
    "i18n:compile": "pnpm -r --if-present i18n:compile"
  }
}
```

These execute in each package directory, finding the right config. Root `.env.local` is **not** discovered from those working directories: export credentials through the parent shell/CI, or provide ignored env files in the owning packages. For parseable output, collect each package's `p6t translate --json` separately; pnpm's recursive log prefixes are not a JSON transport.

## Credentials

| Provider ID | Environment variable |
|---|---|
| `openai` | `OPENAI_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` or `GOOGLE_API_KEY` |
| `mistral` | `MISTRAL_API_KEY` |
| `openrouter` | `OPENROUTER_API_KEY` |
| `ollama` | No API key; optional `provider.baseUrl` |

The current source loads `.env` and `.env.local` from its working directory. Precedence: **shell variables → `.env.local` → `.env`** (an explicitly empty shell value also wins). It does not automatically load every framework-specific environment filename.

**Published `@p6t/cli@0.1.0` limitation:** that release has no env-file loader; neither `.env.local` nor `.env` is loaded automatically. Use exported shell/CI variables or Node 22's explicit loader until running a release containing the fix. For a local `.env.local`, from the owning package:

```sh
node --env-file=.env.local ./node_modules/@p6t/cli/dist/index.js translate --locale de
```

When both files exist, use `--env-file=.env --env-file=.env.local` in that order; Node preserves shell values and the later file overrides the earlier one. Check the installed version's behavior rather than assuming an unreleased source fix is published. A working framework `.env.local` loader does not imply a separately launched CLI inherited those variables.

Use an ignored local file or CI secret store. Check that the needed variable exists without printing its value. Never place keys in `i18n.json`, committed examples, logs, or browser-exposed variables such as `NEXT_PUBLIC_*`.

## Translation context is product knowledge

**Before the first translation run**, review and commit:

```text
i18n/description.md
i18n/de/style-guide.md
i18n/de/glossary.json
i18n/fr/style-guide.md
i18n/fr/glossary.json
```

- **Description:** shared product brief, conventionally in English. Explain the audience, jobs users are doing, domain, and important vocabulary. Write for a translator, not an investor.
- **Style guide:** per-locale formality, tone, brand voice, punctuation, and formatting conventions. Infer established preferences from reviewed translations; ask instead of guessing consequential choices such as German `du` versus `Sie`.
- **Glossary:** a small flat JSON map from source-language terms to required target-language terms. Seed domain terms, compound nouns, drawing abbreviations, and brand preferences before asking the model to translate, not only after review finds inconsistencies.

Example German glossary:

```json
{
  "checkout": "Kasse",
  "subscription": "Abonnement"
}
```

These files guide translation calls alongside source messages, their descriptions/comments, and available source references. LLM-generated context is a draft to review, not a substitute for product decisions. Stubs or an empty glossary are valid starting points when drafting is declined or fails.

For German, explicitly review noun compounding and domain terminology: a plan's “north wall” may require `Nordwand`, not `Wand Nord`; a bond-pattern term must distinguish stack bond from cross bond. Put the domain expert's approved equivalents and abbreviations into the target glossary/voice guide before the first run. Avoid universal dictionary guesses for specialist terms. Review the target catalog **before compiling**; “Done” and successful ICU compilation are not linguistic quality proof.

## Pipeline and behavior

```sh
pnpm i18n:extract
# Seed/review glossaries before the first run.
pnpm exec p6t translate --locale de
# Review target catalogs and run i18n:check before compilation.
pnpm i18n:compile
```

Adapt script names to the repo. Run without `--locale` to process all configured targets.

- react-intl: translates missing/empty `defaultMessage` entries in target catalogs, preserving nonempty entries whose IDs remain in the source.
- Lingui: translates missing/empty or fuzzy entries, so a nonempty fuzzy translation may be replaced. Fuzzy flags are cleared when results are written.
- Both adapters remove target entries absent from the source catalog before translating. Those removed translations can inform subsequent style. **Never translate against a failed, empty, or incomplete extraction.** Review deletions, not just additions.
- Messages are grouped using source-file references and batched for the LLM. Without compatible references, grouping falls back to the catalog. Preserve descriptions and extraction metadata; inspect warnings instead of assuming grouping works.
- p6t asks the model to preserve ICU structure and placeholder names. Compilation and coverage checks are still required; model instructions are not validation guarantees.
- Current source exits nonzero for failed groups or missing model results. Older releases (including `0.1.0`) can report them without failing the process. In every version, inspect actual catalog coverage and quality; do not treat “Done” as a completeness check.

`p6t translate --help` describes installed options. The CLI also supports `--verbose` for raw responses when results are missing and `--max-orphans` to control how many removed translations are supplied as style context (default `50`; `0` disables that context). Debug output can contain project text; do not publish it indiscriminately.

### Agent / CI output (current source; check installed help)

- `--quiet` / `-q`: one concise summary per file plus diagnostics, without spinner, individual message previews, or raw responses.
- `--no-progress`: disable interactive progress. Progress is automatically disabled when stdout is not a TTY; plain output contains no spinner redraws.
- `--json`: one JSON object on stdout, no interactive output or raw LLM responses even with `--verbose`. Diagnostics from adapters may go to stderr. `--json` takes precedence over human-output modes.

```sh
pnpm exec p6t translate --locale de --quiet
pnpm exec p6t translate --json > translation-summary.json
```

The JSON shape is `{ "files": [...], "errors": [] }`. Each file reports `locale`, absolute `sourcePath`/`targetPath`, and counts: `pending` before translation, `translated` written this run, `missing` omitted by the model, `failed` strings in failed groups, and `removed` stale entries. File-level `errors` contain failed-group diagnostics; top-level `errors` contain setup/fatal errors. Already-up-to-date files have zero counts. An incomplete run exits nonzero; summaries do not replace catalog tests or review.

Keep source catalogs, translations, config, and authored context in version control. The documented react-intl setup also commits compiled catalogs; preserve an existing generated-artifact policy or agree explicitly on changing it. AI translation is an explicit development/CI action, not a runtime dependency or an unavoidable network step in normal app builds.
