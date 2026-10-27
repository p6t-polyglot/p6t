# @p6t/cli

## 0.2.0

### Minor Changes

- 6463a96: Restore `.env` loading and make `init` a real update flow.

  Two papercuts surfaced once the CLI moved from a bundled Bun executable to plain Node. Bun had been quietly loading `.env` files for you, so when that magic disappeared, provider API keys kept in a `.env`/`.env.local` silently stopped being found — the kind of failure that makes you doubt your own keys. The CLI now loads them itself, matching Bun's precedence (shell environment wins, then `.env.local` over `.env`), so nothing exported in your shell is ever clobbered.

  Re-running `p6t init` used to greet you with a scary "overwrite?" prompt and then throw away everything you'd already configured. Now it treats an existing `i18n.json` as the starting point: every prompt is pre-filled with your current values and you simply step through and tweak what changed.

## 0.1.0

### Minor Changes

- 86523e6: Grouped translation with orphan context and stale-key cleanup

  The `translate` command now groups strings by source file (component) before sending them to the LLM, giving the translator contextual awareness of which strings belong together in the UI. This produces more consistent, story-aware translations.

  When a translation key is removed from the source locale, it is now automatically removed from target catalogs as well. The user is informed of these removals. Importantly, removed translations are preserved as "orphan" style references and included in subsequent prompts, so the LLM can maintain consistent tone and terminology even when keys are renamed or moved between components.

  For react-intl projects, source-file grouping requires `formatjs extract` with the `--extract-source-location` flag. When this flag is missing, the tool gracefully falls back to catalog-level grouping and prints a helpful warning.

  A new `--max-orphans` flag lets users control how many removed translations are kept as style context in each prompt (default: 50).

### Patch Changes

- Updated dependencies [71786b0]
  - @p6t/config@0.1.0
