# AGENTS.md

## Project

p6t is an early-stage AI-powered auto-translation CLI for React apps. It supports **react-intl** (default) and **Lingui** (experimental). Published packages are `@p6t/cli` and `@p6t/config`.

## Package manager

**pnpm 10.32.1** — do not use npm or yarn.

```bash
pnpm install                  # local setup
pnpm install --frozen-lockfile # CI / reproducible
```

## Monorepo layout

| Path | Package | Published |
|---|---|---|
| `packages/config` | `@p6t/config` | yes |
| `packages/cli` | `@p6t/cli` | yes |
| `apps/docs` | `@p6t/docs` | no |

Workspace deps use `workspace:*` (always resolves to local version).

## Common commands

```bash
pnpm build        # turbo run build — required before typecheck or test
pnpm dev          # turbo run dev (docs on :3001)
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

### CLI build requires Bun
- Production CLI binary: `bun build --compile src/index.ts --outfile dist/p6t` (self-contained, no Node runtime).
- Dev build uses `tsup` (`pnpm --filter @p6t/cli build:dev`).
- **Bun is a compile-time tool only** — not the dev runtime. Node 22 is the dev runtime.
- CI does **not** install Bun yet — `pnpm build` for `@p6t/cli` will fail in CI until a `setup-bun` step is added.

### `packages/config` scope
`@p6t/config` contains the `i18n.json` config schema and shared types (`TranslationUnit`, `TranslationResult`). It has no React or i18n library dependency.

### TypeScript strictness
Root `tsconfig.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `exactOptionalPropertyTypes`, `moduleResolution: "bundler"`. Violations will fail typecheck.

### No formatter
No Prettier, Biome, or ESLint auto-format is configured. Do not assume auto-formatting on save or in CI.

## Communication

Be extremely concise — sacrifice grammar for brevity if needed. Always make a plan and wait for approval before making changes, unless the user asks for a small, direct edit.

## Exploration

Use the explore tool sparingly. Reading config files and a handful of source files is usually enough context.

## Design philosophy

Every session (unless it's a direct technical task) starts with framing, then moves on to shaping and finally goes into implementation. Sometimes these phases are very quick, but they almost always exist.

During framing, we're wondering what the application user is really trying to do and how they feel in that moment. Then shape a conceptual solution — not a spec — that leaves room for good implementation decisions. This is providing enough room for a very senior developer or a very senior designer to still make great decisions during implementation while setting a clear direction.

The first time to ask "What would Kent Beck say?" is during shaping, when you feel the pull toward complexity: defensive caps, premature abstraction, speculative features. Stop there. Simplify the shape before presenting the plan. Then during implementation or during design again ask yourself "What would Kent Beck say?" and apply this to the trade-offs that you're making, the variable names you're using and the way you're thinking about refactoring existing code.

Prefer simplicity, small safe steps, and making the design reflect the problem. Avoid over-engineering.

## Releases (Changesets)

Every user-facing change to a published package needs a changeset before merging:

```bash
pnpm changeset          # author a changeset
pnpm changeset version  # bump versions + update CHANGELOGs
pnpm changeset publish  # publish to npm
```

The release CI workflow runs on every push to `main` and either opens a "Version Packages" PR or publishes (requires `NPM_TOKEN` secret).

### When to suggest a changeset

Once development feels done — the feature works, types pass, the user seems satisfied — proactively ask:

> "Should we add a changeset before wrapping up?"

If framing and shaping happened during the session, the changeset summary must reflect that language: use the problem framing (what the user was trying to do, how they felt) and the shaped solution (the conceptual direction chosen), not just a dry description of the code that was written. The changelog is read by users, not by compilers.

## CI vs local

| | CI | Local |
|---|---|---|
| Install | `--frozen-lockfile` | `pnpm install` |
| Node | 22 (pinned) | any |
| Bun | **not installed** | must be installed for CLI build |
| Lint | not run | `pnpm lint` |
| Steps | build → typecheck → test | run individually |

Skills provide specialized instructions and workflows for specific tasks.
Use the skill tool to load a skill when a task matches its description.
