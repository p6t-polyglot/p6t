---
name: integrate-p6t
description: Sets up p6t in JavaScript/TypeScript repositories with or without React or existing i18n. Use when adding p6t, configuring package-owned catalogs or translation context, or establishing extraction, translation, compilation, and locale selection for apps, generated documents, or embedded widgets. Supports FormatJS/react-intl and experimental Lingui.
---

# Integrate p6t

Help the app reach a working translated experience, not merely an installed CLI. Preserve the existing product and codebase conventions; make the smallest complete integration the user agrees to.

## Quick start

For an app with working extraction and compilation:

```sh
pnpm add -D @p6t/cli
pnpm i18n:extract
pnpm exec p6t init
# Review context and seed target glossaries before translating.
pnpm exec p6t translate --locale de
# Review target catalogs before compiling.
pnpm i18n:compile
```

These are illustrative commands, not permission to run them blindly. Confirm the locale, provider/model, credentials, catalog paths, and script names first. `init` is interactive and can overwrite files; translation sends text/context to the chosen provider and modifies catalogs.

Examples use pnpm. Respect the target repo's package manager, workspace boundaries, and installed versions. Do not require a global CLI installation.

## 1. Inspect before choosing a setup

- Read repo instructions, package manifests, lockfile, framework/router/bundler config, locale selection, representative UI, and existing extraction/compilation scripts.
- Finish with a short inventory: owning packages, installed stack and execution paths (including tests/scripts), locale ownership, message/ID conventions, catalog contract, delivery shape, and working commands.
- Keep a working FormatJS/react-intl or Lingui setup. For a new foundation: React → `react-intl`; non-React JS/TS → `@formatjs/intl` (no React dependency). Both use p6t's `react-intl` catalog format unchanged. Lingui remains experimental.
- If the app uses another library, discuss compatibility or migration instead of silently replacing it. Do not assume arbitrary JSON or gettext formats work unchanged.
- Read framework/library documentation matching the installed versions before changing their build or routing APIs. For Next.js, use installed `next/dist/docs/` when available.

## 2. Agree on the user experience and scope

Ask only what the repo does not already establish:

- What is the source locale, which target locales matter first, and what should missing translations do?
- Who owns each language? Separate stored artifact text, client-owned viewer chrome, and English model-facing text. Would the string still be in an exported PDF/image? If so, use the stored document/project language, not the viewer's preference.
- How does the user choose a language: public URL, profile/cookie, host context, `?lang=`, or stored document language? Does deployment permit catalog fetching/chunks, or require one self-contained HTML document?
- What does the product do, who uses it, and what tone, formality, brand terms, and domain vocabulary should translations preserve?
- Which provider and model should be used, and may project text/context be sent to it? Never ask for an API key in chat; use an ignored environment file or secret store.
- Is this pipeline-only integration, a first translated screen, or a broader migration?

Present a short plan and wait for approval before editing dependencies, routing, application code, or existing catalogs. Do not turn a setup request into an unsolicited whole-app rewrite.

## 3. Build the chosen foundation

Load references by branch; all are bundled with this skill:

- For every p6t setup, read [p6t.md](p6t.md): CLI behavior, configuration, credentials, context, and safe operation.
- When adapting react-intl/FormatJS, including non-React TS, read [react-intl.md](react-intl.md): generated IDs with or without transforms, extraction, compilation, single-file delivery, and linter-independent catalog tests.
- When adapting Lingui, read [lingui.md](lingui.md): experimental PO integration, build transforms, catalogs, activation, and compilation.
- When choosing/changing locale selection (with or without routes), read [locale-routing.md](locale-routing.md): stored document language, host/query/browser precedence, public URLs, profile preferences, and switching.

Apply the companion `translatability` skill when available. Regardless, keep source messages and intent beside their usage, generate IDs, share meaning through code rather than magic keys, and use complete messages with locale-aware formatting. Do not migrate an existing ID scheme without agreement.

Get extraction and compilation working before adding AI translation. Include an agreed representative screen with meaningful descriptions/comments, interpolation, and plural behavior. Preserve available source references so p6t can group related messages.

## 4. Configure p6t and translation context

- Install the CLI locally in the appropriate workspace. Run commands from the application/config directory; environment-file discovery is based on the working directory.
- Use `p6t init` for a new interactive setup, or create the documented files manually when no interactive terminal is available. Do not invent unattended flags.
- Inspect existing files before rerunning init. Merge configuration deliberately; LLM context drafting may replace authored context.
- Set `format` explicitly. Point react-intl catalogs at extracted JSON, not compiled runtime JSON; Lingui paths come from its own configuration.
- Before the first translation run, review the product brief and per-locale voice guides; seed glossaries with domain terms, compound nouns, and drawing abbreviations. Commit them and catalogs; keep API keys out of commits and browser bundles.
- In monorepos, configure each owning package separately; use the shared-context/root-script recipe in [p6t.md](p6t.md). Domain-artifact and viewer-chrome packages need not share a language lifecycle.

## 5. Verify and hand off

- [ ] Run a complete, successful extraction covering the relevant application/shared code. Inspect the source catalog before translation: stale-entry removal must not run against empty or incomplete extraction output.
- [ ] With permission and credentials, translate a configured target locale. Review target terminology and catalog diffs before compiling; an exit status or “Done” is not quality proof.
- [ ] Check preserved human translations, intentional stale removals, ICU syntax, placeholders, generated-ID map coverage where used, and required-message coverage. Compile reviewed catalogs.
- [ ] Run the repo's build/typecheck/lint/tests as applicable. Check the translated experience, fallback, accessibility, long text, plural boundaries, language switching, and persistence.
- [ ] For SSR, check locale isolation and hydration. For mixed routes, check that public redirects never hijack private/auth/API/asset paths.
- [ ] For generated artifacts, reproduce exports from stored language and set SVG/HTML `lang`. Viewer locale changes must leave document data and artifact wording unchanged. For single-file delivery, verify inline catalogs and resource/cache identity changes.
- [ ] Report changed files, exact workflow commands, checks performed, and any blocked checks. If credentials are unavailable, leave a working local foundation and clearly identify the unverified provider step.

Keep translation an explicit authoring/CI task, not a mandatory network request during every application build or at runtime. Offer an `AGENTS.md` instruction to apply `translatability` when changing UI; get approval before adding it. Do not commit automatically.
