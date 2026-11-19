---
"@p6t/cli": minor
"@p6t/config": minor
---

Use the coding agent you already work with to keep react-intl catalogs up to date, without configuring a separate model or key for p6t. Run `p6t mcp` to give your agent a read-only preview of missing and obsolete messages, plus the glossary and style guide. The agent drafts the translations; p6t checks ICU placeholders and prunes obsolete keys, even when nothing needs translating. Glossary proposals stay separate for review.

For new projects, the agent can inspect existing catalogs and scaffold `i18n.json` and translation context without shelling out to `p6t init`.

`provider` is now optional in `i18n.json` for the agent workflow and remains required for `p6t translate`. Use `translationInstructions` to share project-specific guidance across both workflows.
