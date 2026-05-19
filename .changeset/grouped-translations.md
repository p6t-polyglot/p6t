---
"@p6t/cli": minor
---

Grouped translation with orphan context and stale-key cleanup

The `translate` command now groups strings by source file (component) before sending them to the LLM, giving the translator contextual awareness of which strings belong together in the UI. This produces more consistent, story-aware translations.

When a translation key is removed from the source locale, it is now automatically removed from target catalogs as well. The user is informed of these removals. Importantly, removed translations are preserved as "orphan" style references and included in subsequent prompts, so the LLM can maintain consistent tone and terminology even when keys are renamed or moved between components.

For react-intl projects, source-file grouping requires `formatjs extract` with the `--extract-source-location` flag. When this flag is missing, the tool gracefully falls back to catalog-level grouping and prints a helpful warning.

A new `--max-orphans` flag lets users control how many removed translations are kept as style context in each prompt (default: 50).
