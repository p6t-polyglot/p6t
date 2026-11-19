---
name: integrate-p6t
description: Sets up p6t in JavaScript/TypeScript repositories with or without React or existing i18n. Use when adding p6t, configuring package-owned catalogs or translation context, or establishing extraction, translation, compilation, and locale selection for apps, generated documents, or embedded widgets. Supports FormatJS/react-intl and experimental Lingui.
---

# Integrate p6t

Help the app reach a working translated experience, not merely an installed CLI. Preserve the existing product and codebase conventions; make the smallest complete integration the user agrees to.

## Quick start

**Default to MCP for FormatJS/react-intl.** Install `@p6t/cli` locally, register the workspace's `p6t mcp` server in the agent host, and use its tools for p6t work. Use project scripts for extraction and compilation. This route uses the agent's model; it needs no p6t provider or key.

Use the direct CLI for unattended translation, existing Lingui projects, or when MCP is unavailable and the user agrees to the fallback. [p6t.md](p6t.md) covers registration, installed-version checks, and the CLI fallback.

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
- If using the direct CLI, which provider and model are approved to receive project text and context?
- Is this pipeline-only integration, a first translated screen, or a broader migration?

Present a short plan and wait for approval before editing dependencies, routing, application code, or existing catalogs. Do not turn a setup request into an unsolicited whole-app rewrite.

## 3. Build the chosen foundation

Load references by branch; all are bundled with this skill:

- For every p6t setup, read [p6t.md](p6t.md): MCP registration, configuration, safe operation, and direct CLI fallback.
- When adapting react-intl/FormatJS, including non-React TS, read [react-intl.md](react-intl.md): generated IDs with or without transforms, extraction, compilation, single-file delivery, and linter-independent catalog tests.
- When adapting Lingui, read [lingui.md](lingui.md): experimental PO integration, build transforms, catalogs, activation, and compilation.
- When choosing/changing locale selection (with or without routes), read [locale-routing.md](locale-routing.md): stored document language, host/query/browser precedence, public URLs, profile preferences, and switching.

Apply the companion `translatability` skill when available. Regardless, keep source messages and intent beside their usage, generate IDs, share meaning through code rather than magic keys, and use complete messages with locale-aware formatting. Do not migrate an existing ID scheme without agreement.

Get extraction and compilation working before adding AI translation. Include an agreed representative screen with meaningful descriptions/comments, interpolation, and plural behavior. Preserve available source references so p6t can group related messages.

## 4. Configure p6t and translation context

- Call `inspect_project` before setup. Once locales and catalog paths are agreed, call `init_project` for a new project; merge existing configuration deliberately.
- Set `format` explicitly. Point react-intl catalogs at extracted JSON, not compiled runtime JSON; Lingui paths come from its own configuration.
- Draft or review the product brief and locale guides using the recipe returned by `inspect_project`. Before translating, confirm that each rule changes a plausible translation and any unresolved terminology or voice choices are visible to the reviewer.
- In monorepos, configure each owning package separately; use the shared-context/root-script recipe in [p6t.md](p6t.md). Domain-artifact and viewer-chrome packages need not share a language lifecycle.

## 5. Verify and hand off

- [ ] Run a complete, successful extraction covering the relevant application/shared code. Inspect the source catalog before translation: stale-entry removal must not run against empty or incomplete extraction output.
- [ ] For MCP, call `prepare_locale` and follow its next step. For the CLI fallback, translate only with the approved provider. Review target terminology and catalog diffs before compiling.
- [ ] Check preserved human translations, intentional stale removals, ICU syntax, placeholders, generated-ID map coverage where used, and required-message coverage. Compile reviewed catalogs.
- [ ] Run the repo's build/typecheck/lint/tests as applicable. Check the translated experience, fallback, accessibility, long text, plural boundaries, language switching, and persistence.
- [ ] For SSR, check locale isolation and hydration. For mixed routes, check that public redirects never hijack private/auth/API/asset paths.
- [ ] For generated artifacts, reproduce exports from stored language and set SVG/HTML `lang`. Viewer locale changes must leave document data and artifact wording unchanged. For single-file delivery, verify inline catalogs and resource/cache identity changes.
- [ ] Report changed files, tools or commands used, checks performed, and any blocked steps.

Keep translation an explicit authoring/CI task, not a mandatory network request during every application build or at runtime. Offer an `AGENTS.md` instruction to apply `translatability` when changing UI; get approval before adding it. Do not commit automatically.
