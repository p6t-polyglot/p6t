# p6t (polyglot)

p6t keeps translation catalogs up to date for React apps. Use your coding agent through MCP for **react-intl**, or run the CLI with your own LLM provider for **react-intl** or **Lingui** (experimental).

## Getting started

```sh
# Make sure the API key for the generative AI provider of your choice 
# is available in .env or provide it explicitly in the terminal. e.g.
# export GOOGLE_GENERATIVE_AI_API_KEY=your_key_here


# 1. Install as a dev dependency
pnpm add -D @p6t/cli

# 2. Initialize the config
pnpm p6t init

# 3. Run your first translation
pnpm p6t translate
```

## Use your coding agent through MCP

Register a local **stdio** MCP server in your agent host. For a project with `@p6t/cli` installed, launch:

```sh
pnpm --dir /absolute/path/to/project exec p6t mcp
```

For a new project, ask the agent to **“Set up p6t for English and German.”** `inspect_project` looks for existing configuration and catalogs; `init_project` scaffolds configuration and context files after you agree on the locales and paths. It won’t overwrite existing context.

The resulting `i18n.json` needs no `provider` or separate p6t model key:

```json
{
  "$schema": "https://p6t.dev/schema/i18n.json",
  "version": 1,
  "format": "react-intl",
  "locale": { "source": "en", "targets": ["de"] },
  "catalogs": [{ "path": "i18n/{locale}.json" }]
}
```

Ask your agent: **“Refresh the source catalog and bring German up to date with p6t.”**

```text
Refresh source catalog → prepare_locale (read only) → agent translates
    → apply_locale (validate, write, prune) → review the Git diff
```

The agent uses its existing model. p6t still prunes obsolete keys when there’s nothing to translate. If a catalog changes after preparation, the agent needs a fresh plan. For a review without edits, ask the agent to report the plan only.

No skill is required. The server explains when to use the workflow and what makes a useful glossary proposal. Suggestions stay in the review until you approve a specific entry; the agent can then edit the locale glossary separately. Put shared project rules in `translationInstructions` or the locale style guides.

## Agent skills

Two skills teach your coding agent to write translatable UI and to wire up p6t:

- [translatability](skills/translatability/SKILL.md) — source-first UI development and review. Works with or without p6t.
- [integrate-p6t](skills/integrate-p6t/SKILL.md) — add p6t to an existing React app, with react-intl or Lingui.

### 1. Install

```sh
npx skills add p6t-polyglot/p6t -g
```

The [skills CLI](https://skills.sh) detects your agent (Claude Code, Codex, OpenCode, Cursor, …) and installs both skills where it looks for them. Drop `-g` to install only into the current project, add `--skill translatability` to install one skill, or `--list` to inspect first.

### 2. Tell your agent to use them

Name the skill in your request:

- “Use the `translatability` skill while adding this settings form.”
- “Review this UI for translatability, including errors and accessible labels.”
- “Use the `integrate-p6t` skill to add German and French to this React app. Inspect the existing setup and propose a plan first.”

Restart your agent if it does not pick up the new skills. To apply translatability by default, add the skill to the repo's `AGENTS.md`. More examples are in [skills/](skills/README.md).

## How it works

With `p6t translate`, p6t sends missing messages directly to your configured LLM provider. With `p6t mcp`, your coding agent drafts the translations. Both paths use the project's locale context, including its glossary and style guide.

For the result to sound really good, p6t requires context on your source strings, including the source file and a description of the translation that captures the intent of the element. If you're starting from scratch, I've written a compact guide on how to set up react-intl in your Next.js application.

All files are checked into the repository so you have full control over them. By building on top of react-intl, your coding agent will immediately know how to internationalize your app. You likely won't need any traditional translation management system (TMS) in the beginning, but if you want to use one, you can do that with any that supports react-intl, wich is most of them.

With p6t there should be zero reason not to launch multi-lingual from the very beginning.
