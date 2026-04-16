# Monorepo Setup Plan
**Auto-Translation Platform (built on fbtee) — Developer Brief**

---

## Overview

This document outlines the monorepo structure and toolchain decisions for the auto-translation platform. We're building on top of **fbtee**, which uses `<fbt>` JSX components compiled via Babel — this shapes several decisions around build configuration and package responsibilities.

---

## Toolchain Decisions

| Tool | Decision & Rationale |
|---|---|
| **Package manager** | pnpm — strict dependency resolution, best monorepo workspace support, familiar to contributors |
| **Task orchestration** | Turborepo — low config overhead, remote caching, ideal for this repo scale |
| **Primary runtime** | Node.js — used for Next.js app and dev tooling; no runtime fragmentation |
| **CLI build target** | Bun (compile only) — produces self-contained binary via `bun build --compile`; not used as dev runtime |
| **Web framework** | Next.js (`apps/web`) — primary framework to support; doubles as the hosted translator app |
| **Language** | TypeScript throughout — strict mode |
| **Translation base** | fbtee — `<fbt>` JSX components compiled via Babel preset |

> **Note:** Bun is used only as a compiler for the CLI binary output, not as a development runtime. This keeps the contributor experience consistent across the whole monorepo.

---

## fbtee Architecture Implications

fbtee works through Babel compilation — the `<fbt>` and `<fbt:param>` JSX components are transformed at build time into optimised translation calls. This has a few structural consequences worth planning for up front.

**The Babel preset wires in per build tool, not at the repo root.** For Vite-based packages, you pass `@nkzw/babel-preset-fbtee` directly into `@vitejs/plugin-react`'s `babel` option in `vite.config.ts` — no shared root config needed. For Next.js, adding a `babel.config.js` at the app root disables SWC and enables the fbtee preset. These are separate configurations, not inherited from a monorepo root.

**String collection runs at the app level, not per package.** fbtee's workflow is two commands: `fbtee collect` scans source files and outputs a `source_strings.json`, and `fbtee translate` takes that plus your translation files and compiles an optimised runtime payload. The starting assumption for this monorepo is that `fbtee collect` runs inside `apps/web`, pointing at all consumed source — including the compiled output of `packages/react`. `packages/react` itself should not have its own collection step, since it's translation infrastructure, not translated content.

**`packages/core` stays fbtee-free.** Core handles locale loading, namespace management, and config — but no `<fbt>` usage. This keeps it truly framework-agnostic for future native targets.

**`fbt()` for non-JSX contexts.** The CLI and any Node scripts should use `fbt()` (the function form) rather than `<fbt>` JSX components where there's no JSX context.

---

## Repository Structure

```
.
├── apps/
│   └── web/                    # Next.js translator app (hosted product)
│       └── babel.config.js     # disables SWC, enables fbtee preset (Next.js only)
│
├── packages/
│   ├── react/                  # @your-org/react — primary React SDK
│   ├── core/                   # @your-org/core — framework-agnostic logic
│   └── cli/                    # @your-org/cli — developer CLI tool
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

> **Key decision:** `packages/core` has no fbtee dependency. It handles locale loading, interpolation config, and namespace resolution — everything that doesn't require JSX. `packages/react` is the thin layer that adds `<fbt>` component bindings on top.

---

## Package Details

### `apps/web`

The hosted translator interface — a Next.js app used by human translators to review and manage translations. Also serves as the primary reference implementation for fbtee + Next.js integration.

- Bootstrap with `create-next-app`, TypeScript, Tailwind, App Router
- Imports `packages/react` for the SDK and `packages/core` for shared logic
- Add `babel.config.js` at the app root to disable SWC and enable `@nkzw/babel-preset-fbtee`
- Deployed to Vercel (Node runtime)
- Owns the fbtee string collection pipeline — `fbtee collect` runs here, pointing at all source including consumed packages

### `packages/react`

The primary developer-facing SDK. This is the package most consumers will install.

- Package name: `@your-org/react`
- Peer deps: `react`, `react-dom` — do not bundle React
- Built with **tsup** — produces ESM and CJS outputs
- Depends on `packages/core` via `workspace:*`
- The fbtee Babel transform is applied by the consuming app's build tool, not by this package's own build
- Exports:
  - Components: `<TranslationProvider>`, `<T>` (a thin wrapper for common `<fbt>` patterns)
  - Hooks: `useTranslation()`, `useLocale()`

### `packages/core`

Framework-agnostic translation engine. No React, no fbtee, no runtime assumptions.

- Package name: `@your-org/core`
- Pure TypeScript, ships as ESM only
- Handles: locale detection, config resolution, namespace/chunk loading, pluralisation rules
- **No `<fbt>` usage here** — this is what makes future Vue/Svelte/native SDKs possible
- Future native SDKs (`packages/react-native`, `packages/swift`) will depend on this

### `packages/cli`

Developer CLI for extracting translation keys, pushing/pulling from translation sources, and checking coverage.

- Package name: `@your-org/cli`
- Wraps `fbtee collect` and `fbtee translate` with a better DX and integration hooks (push/pull from translation providers)
- Developed in Node/TypeScript, compiled to a single binary with `bun build --compile`
- Distributed binary has no runtime dependency (no Node required on end user machine)
- Uses `fbt()` (function form) for any CLI-facing translated strings
- Planned commands: `extract`, `push`, `pull`, `check`, `init`

---

## Key Configuration Files

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

String collection is not a Turborepo task — `fbtee collect` runs directly inside `apps/web` as an npm script, not orchestrated across packages.

### `apps/web/babel.config.js`

```js
module.exports = {
  presets: ['@nkzw/babel-preset-fbtee'],
};
```

This file's presence at the Next.js app root disables SWC automatically and opts into Babel. Keep it minimal — Next.js handles the rest of the transform pipeline.

### `apps/web/package.json` scripts (fbtee)

```json
{
  "scripts": {
    "fbtee:collect": "fbtee collect",
    "fbtee:translate": "fbtee translate --translations translations/*.json"
  }
}
```

`fbtee collect` scans source files and outputs `source_strings.json`. `fbtee translate` takes that plus your translation files and compiles an optimised runtime payload. Run `fbtee:collect` before uploading strings to a translation provider, and `fbtee:translate` after pulling translations back.

### Root `package.json` scripts

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules"
  }
}
```

---

## Versioning & Publishing

Use **Changesets** for versioning and changelog management.

```bash
# Install
pnpm add -D @changesets/cli -w
pnpm changeset init

# Workflow
pnpm changeset          # author a changeset when making changes
pnpm changeset version  # bump versions + update CHANGELOGs
pnpm changeset publish  # publish to npm
```

- `packages/react`, `packages/core`, `packages/cli` — all public, published to npm
- `apps/web` — private, never published
- Wire up a GitHub Actions release workflow to automate publishing on merge to `main`

---

## Setup Steps

Recommended order of operations:

### 1. Scaffold the root

```bash
mkdir auto-translate && cd auto-translate
git init
pnpm init
pnpm add -D turbo typescript -w
# create turbo.json, pnpm-workspace.yaml, root tsconfig.json, babel.config.js
```

### 2. Create `packages/core` first

No internal dependencies — build this first so other packages can reference it.

```bash
mkdir -p packages/core/src
# pnpm init, configure tsup, write initial locale/config logic
# no fbtee dependency here
```

### 3. Create `packages/react`

```bash
mkdir -p packages/react/src
# Add @your-org/core as workspace dep: "workspace:*"
# Add fbtee, configure tsup with Babel (for fbt transform)
# Write TranslationProvider, useTranslation hook, <T> component
```

### 4. Bootstrap `apps/web`

```bash
cd apps && pnpm create next-app web --typescript --tailwind --app
# Add apps/web/babel.config.js with @nkzw/babel-preset-fbtee (disables SWC)
# Add @your-org/react and @your-org/core as workspace deps
# Add fbtee:collect and fbtee:translate scripts to apps/web/package.json
```

### 5. Scaffold `packages/cli`

```bash
mkdir -p packages/cli/src
# Build as Node/TypeScript
# Add bun build --compile as the dist step for binary output
# Wire up commander or citty for argument parsing
# Wrap fbtee collect/translate for the extract command
```

### 6. Add Changesets + CI

```bash
pnpm add -D @changesets/cli -w
pnpm changeset init
# Add .github/workflows/release.yml
# Add .github/workflows/ci.yml (build, typecheck, test)
```

---

## Future: Native App Support

When native becomes a priority, the structure accommodates it without restructuring:

```
packages/
  core/           # already runtime-agnostic — no changes needed
  react/          # existing React web SDK
  react-native/   # new: depends on core, uses fbt RN bindings if available
  swift/          # new: separate toolchain (Swift Package Manager)
  kotlin/         # new: separate toolchain (Gradle)
```

At that point, revisit **[moon](https://moonrepo.dev)** as a Turborepo replacement — its multi-language toolchain support and non-JS task running is meaningfully better for polyglot monorepos than Turborepo.

---

*Questions? The fbtee architecture implications section covers the key decisions. The most important thing to verify early is that `fbtee collect` correctly picks up strings from `packages/react` source when run from `apps/web` — test this before building out the full translation pipeline.*