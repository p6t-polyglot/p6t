# Agent skills

Two companion skills, usable independently:

| Skill | Purpose |
|---|---|
| [translatability](translatability/SKILL.md) | Everyday source-first UI development: intent-rich messages, generated IDs, explicit code reuse, and locale-aware presentation. Does not require p6t. |
| [integrate-p6t](integrate-p6t/SKILL.md) | Add p6t to an existing React repo, with or without i18n; covers react-intl, experimental Lingui support, locale UX, configuration, and the translation pipeline. |

## Install and share

Once these files are available in the GitHub repository:

```sh
pnpm dlx skills add p6t-polyglot/p6t
```

To install only one, append `--skill translatability` or `--skill integrate-p6t`. Choose the target agent/location through the installer's options or prompts. Alternatively, copy the desired skill directory, including its reference files, into your agent's supported skills directory. Neither skill requires scripts, a p6t source checkout, or the companion skill.

## Example requests

- “Use translatability while adding this settings form. Keep messages beside their usage; share concepts through code, not translation keys.”
- “Review this UI for translatability, including errors and accessible labels.”
- “Use integrate-p6t to add German and French to this React app. Inspect the existing setup and propose a plan first.”
- “Connect p6t to our existing Lingui catalogs without changing locale routing.”

For everyday guidance, consider adding this to the target repo's `AGENTS.md` after agreeing on it:

> When creating or changing user-facing UI, apply the `translatability` skill. Keep source messages and intent in code, generate catalog IDs, and share meaning through code rather than magic translation keys.

The integration skill includes only the setup references needed for the chosen stack. Framework examples must be checked against the target project's installed versions; they are not a reason to replace an existing working setup.
