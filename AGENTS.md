# AGENTS.md

## Project

p6t is an early-stage auto-translation platform built on [fbtee](https://github.com/nkzw-tech/fbtee). Packages are published; the web app is private.

## Package manager

**pnpm 10.32.1** — do not use npm or yarn.

```bash
pnpm install                  # local setup
pnpm install --frozen-lockfile # CI / reproducible
```

## Monorepo layout

| Path | Package | Published |
|---|---|---|
| `packages/core` | `@p6t/core` | yes |
| `packages/react` | `@p6t/react` | yes |
| `packages/cli` | `@p6t/cli` | yes |
| `apps/web` | (web) | no — ignored by Changesets |
| `apps/docs` | `@p6t/docs` | no |

Workspace deps use `workspace:*` (always resolves to local version).

## Common commands

```bash
pnpm build        # turbo run build — required before typecheck or test
pnpm dev          # turbo run dev (web on :3000, docs on :3001)
pnpm typecheck    # turbo run typecheck (tsc --noEmit everywhere)
pnpm lint         # turbo run lint — currently identical to typecheck in packages; docs uses next lint
pnpm test         # turbo run test — no tests exist yet
pnpm clean        # turbo run clean && rm -rf node_modules
```

**Required ordering from clean state:**
```bash
pnpm install && pnpm build && pnpm typecheck
```

Turborepo's `"dependsOn": ["^build"]` means `typecheck` and `test` trigger upstream builds automatically, but a prior `pnpm build` avoids redundant work.

## Toolchain quirks

### fbtee / Babel in `apps/web`
- `apps/web/babel.config.js` **intentionally disables Next.js SWC** and activates `@nkzw/babel-preset-fbtee`. Do not remove or replace this file.
- String collection runs at the web app level only:
  ```bash
  pnpm --filter web fbtee:collect   # extract source strings
  pnpm --filter web fbtee:translate # compile translations
  ```

### CLI build requires Bun
- Production CLI binary: `bun build --compile src/index.ts --outfile dist/p6t` (self-contained, no Node runtime).
- Dev build uses `tsup` (`pnpm --filter @p6t/cli build:dev`).
- **Bun is a compile-time tool only** — not the dev runtime. Node 22 is the dev runtime.
- CI does **not** install Bun yet — `pnpm build` for `@p6t/cli` will fail in CI until a `setup-bun` step is added.

### `packages/core` must stay fbtee-free
Architectural constraint: `@p6t/core` has zero fbtee dependency to remain runtime-agnostic for future native targets (React Native, Swift, Kotlin). Do not add fbtee imports there.

### `<fbt>` JSX vs `fbt()` function
Use `<fbt>` JSX only in JSX contexts. In the CLI, Node scripts, or non-JSX code, use the `fbt()` function form.

### TypeScript strictness
Root `tsconfig.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `exactOptionalPropertyTypes`, `moduleResolution: "bundler"`. Violations will fail typecheck.

### No formatter
No Prettier, Biome, or ESLint auto-format is configured. Do not assume auto-formatting on save or in CI.

## Communication

Be extremely concise — sacrifice grammar for brevity if needed. Always make a plan and wait for approval before making changes, unless the user asks for a small, direct edit.

## Exploration

Use the explore tool sparingly. Reading config files and a handful of source files is usually enough context.

## Design philosophy

When facing a judgement call on software design, ask: "What would Kent Beck say?" Prefer simplicity, small safe steps, and making the design reflect the problem. Avoid over-engineering.

## Releases (Changesets)

Every user-facing change to a published package needs a changeset before merging:

```bash
pnpm changeset          # author a changeset
pnpm changeset version  # bump versions + update CHANGELOGs
pnpm changeset publish  # publish to npm
```

The release CI workflow runs on every push to `main` and either opens a "Version Packages" PR or publishes (requires `NPM_TOKEN` secret). `apps/web` is excluded from versioning.

## CI vs local

| | CI | Local |
|---|---|---|
| Install | `--frozen-lockfile` | `pnpm install` |
| Node | 22 (pinned) | any |
| Bun | **not installed** | must be installed for CLI build |
| Lint | not run | `pnpm lint` |
| Steps | build → typecheck → test | run individually |
