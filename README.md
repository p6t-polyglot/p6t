# p6t (polyglot)

Auto-translation platform built on [fbtee](https://github.com/nkzw-tech/fbtee).

## Packages

| Package | Description | Status |
|---|---|---|
| [`@p6t/core`](./packages/core) | Framework-agnostic translation engine | WIP |
| [`@p6t/react`](./packages/react) | React SDK — components and hooks | WIP |
| [`@p6t/cli`](./packages/cli) | Developer CLI — extract, push, pull, check | WIP |
| [`apps/web`](./apps/web) | Hosted translator interface (Next.js) | WIP |

## Toolchain

| Tool | Role |
|---|---|
| pnpm | Package manager (workspaces) |
| Turborepo | Task orchestration and caching |
| TypeScript | Language (strict mode throughout) |
| tsup | Build tool for `packages/*` |
| Bun | Compile-only — produces the `@p6t/cli` binary |
| Next.js | Web app framework (`apps/web`) |
| fbtee | Translation base — `<fbt>` JSX components compiled via Babel |
| Changesets | Versioning and changelog |

## Getting started

```bash
pnpm install
pnpm build
pnpm dev
```

## Repository structure

```
.
├── apps/
│   └── web/                    # Next.js translator app (hosted product)
│       └── babel.config.js     # disables SWC, enables fbtee preset
│
├── packages/
│   ├── core/                   # @p6t/core — framework-agnostic logic
│   ├── react/                  # @p6t/react — primary React SDK
│   └── cli/                    # @p6t/cli — developer CLI
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## fbtee translation pipeline

String collection runs inside `apps/web`, pointing at all consumed source including packages:

```bash
# collect strings from source
pnpm --filter web fbtee:collect

# compile translated strings into runtime payload
pnpm --filter web fbtee:translate
```

Run `fbtee:collect` before uploading to a translation provider. Run `fbtee:translate` after pulling translations back.

## Versioning and publishing

This repo uses [Changesets](https://github.com/changesets/changesets).

```bash
pnpm changeset          # author a changeset
pnpm changeset version  # bump versions + update CHANGELOGs
pnpm changeset publish  # publish to npm
```

`@p6t/core`, `@p6t/react`, and `@p6t/cli` are published to npm. `apps/web` is private.

## Future

When native targets become a priority, `packages/core` is already runtime-agnostic — no changes needed. New packages (`react-native`, `swift`, `kotlin`) will depend on it. At that point, [moon](https://moonrepo.dev) is worth revisiting as a Turborepo replacement for its multi-language toolchain support.
