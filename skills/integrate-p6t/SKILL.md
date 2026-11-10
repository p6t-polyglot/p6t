---
name: integrate-p6t
description: Sets up p6t in React repositories with or without existing i18n. Use when adding p6t to an app, configuring its catalogs or translation context, or establishing its extraction, translation, and compilation pipeline and locale selection. Supports react-intl and experimental Lingui.
---

# Integrate p6t

Help the app reach a working translated experience, not merely an installed CLI. Preserve the existing product and codebase conventions; make the smallest complete integration the user agrees to.

## Quick start

For an app with working extraction and compilation:

```sh
pnpm add -D @p6t/cli
pnpm i18n:extract
pnpm exec p6t init
pnpm exec p6t translate --locale de
pnpm i18n:compile
```

These are illustrative commands, not permission to run them blindly. Confirm the locale, provider/model, credentials, catalog paths, and script names first. `init` is interactive and can overwrite files; translation sends text/context to the chosen provider and modifies catalogs.

Examples use pnpm. Respect the target repo's package manager, workspace boundaries, and installed versions. Do not require a global CLI installation.

## 1. Inspect before choosing a setup

- Read repo instructions, package manifests, lockfile, framework/router/bundler config, locale selection, representative UI, and existing extraction/compilation scripts.
- Finish with a short inventory: application directory, installed stack, supported locales and their source of truth, message/ID conventions, catalog contract, server/client message flow, and working commands.
- Keep a working react-intl or Lingui setup. For a new foundation, recommend react-intl; explain that p6t's Lingui support is experimental.
- If the app uses another library, discuss compatibility or migration instead of silently replacing it. Do not assume arbitrary JSON or gettext formats work unchanged.
- Read framework/library documentation matching the installed versions before changing their build or routing APIs. For Next.js, use installed `next/dist/docs/` when available.

## 2. Agree on the user experience and scope

Ask only what the repo does not already establish:

- What is the source locale, which target locales matter first, and what should missing translations do?
- How does the user choose a language? Which routes need public, indexable locale URLs? Which should use a profile preference or a cookie?
- What does the product do, who uses it, and what tone, formality, brand terms, and domain vocabulary should translations preserve?
- Which provider and model should be used, and may project text/context be sent to it? Never ask for an API key in chat; use an ignored environment file or secret store.
- Is this pipeline-only integration, a first translated screen, or a broader migration?

Present a short plan and wait for approval before editing dependencies, routing, application code, or existing catalogs. Do not turn a setup request into an unsolicited whole-app rewrite.

## 3. Build the chosen foundation

Load references by branch; all are bundled with this skill:

- For every p6t setup, read [p6t.md](p6t.md): CLI behavior, configuration, credentials, context, and safe operation.
- When adapting react-intl/FormatJS, read [react-intl.md](react-intl.md): generated IDs, extraction metadata, compilation, providers, server/client paths, linting.
- When adapting Lingui, read [lingui.md](lingui.md): experimental PO integration, build transforms, catalogs, activation, and compilation.
- When choosing/changing locale selection or routing, read [locale-routing.md](locale-routing.md): public URLs, profile preferences, auth cookies, and language switching.

Apply the companion `translatability` skill when available. Regardless, keep source messages and intent beside their usage, generate IDs, share meaning through code rather than magic keys, and use complete messages with locale-aware formatting. Do not migrate an existing ID scheme without agreement.

Get extraction and compilation working before adding AI translation. Include an agreed representative screen with meaningful descriptions/comments, interpolation, and plural behavior. Preserve available source references so p6t can group related messages.

## 4. Configure p6t and translation context

- Install the CLI locally in the appropriate workspace. Run commands from the application/config directory; environment-file discovery is based on the working directory.
- Use `p6t init` for a new interactive setup, or create the documented files manually when no interactive terminal is available. Do not invent unattended flags.
- Inspect existing files before rerunning init. Merge configuration deliberately; LLM context drafting may replace authored context.
- Set `format` explicitly. Point react-intl catalogs at extracted JSON, not compiled runtime JSON; Lingui paths come from its own configuration.
- Review the product brief, per-locale voice guides, and source-to-target glossaries. Commit them and catalogs; keep API keys out of commits and browser bundles.

## 5. Verify and hand off

- [ ] Run a complete, successful extraction covering the relevant application/shared code. Inspect the source catalog before translation: stale-entry removal must not run against empty or incomplete extraction output.
- [ ] With permission and credentials, translate a configured target locale, then compile. Review output for errors and missing results; an exit status or “Done” is not proof of complete coverage.
- [ ] Review catalog diffs, preserved human translations, intentional stale removals, ICU syntax, placeholders, and required-message coverage.
- [ ] Run the repo's build/typecheck/lint/tests as applicable. Check the translated experience, fallback, accessibility, long text, plural boundaries, language switching, and persistence.
- [ ] For SSR, check locale isolation and hydration. For mixed routes, check that public redirects never hijack private/auth/API/asset paths.
- [ ] Report changed files, exact workflow commands, checks performed, and any blocked checks. If credentials are unavailable, leave a working local foundation and clearly identify the unverified provider step.

Keep translation an explicit authoring/CI task, not a mandatory network request during every application build or at runtime. Offer an `AGENTS.md` instruction to apply `translatability` when changing UI; get approval before adding it. Do not commit automatically.
