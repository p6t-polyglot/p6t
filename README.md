# p6t (polyglot)

Auto-translation platform. Wraps your existing i18n library with a translation pipeline and React SDK.

## Packages

| Package | Description | Status |
|---|---|---|
| [`@p6t/core`](./packages/core) | Framework-agnostic engine: locale detection, config resolution | WIP |
| [`@p6t/lingui`](./packages/lingui) | Lingui adapter — `LocaleProvider`, hooks, Next.js middleware | WIP |
| [`@p6t/fbtee`](./packages/fbtee) | fbtee adapter — `LocaleProvider`, hooks, Next.js middleware | WIP |
| [`@p6t/cli`](./packages/cli) | Developer CLI — `p6t translate` pipeline | WIP |
| [`apps/web`](./apps/web) | Hosted translator interface (Next.js) | WIP |

Choose `@p6t/lingui` or `@p6t/fbtee` depending on which translation library your app uses.

## Toolchain

| Tool | Role |
|---|---|
| pnpm | Package manager (workspaces) |
| Turborepo | Task orchestration and caching |
| TypeScript | Language (strict mode throughout) |
| tsup | Build tool for `packages/*` |
| Bun | Compile-only — produces the `@p6t/cli` binary |
| Next.js | Web app framework (`apps/web`) |
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
│   ├── lingui/                 # @p6t/lingui — Lingui adapter
│   ├── fbtee/                  # @p6t/fbtee — fbtee adapter
│   └── cli/                    # @p6t/cli — developer CLI
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Translation pipeline

`p6t translate` sits between `lingui extract` / `fbtee:collect` and the compile step:

```bash
# Lingui
lingui extract && p6t translate && lingui compile

# fbtee
pnpm fbtee:collect && p6t translate && pnpm fbtee:translate
```

## Versioning and publishing

This repo uses [Changesets](https://github.com/changesets/changesets).

```bash
pnpm changeset          # author a changeset
pnpm changeset version  # bump versions + update CHANGELOGs
pnpm changeset publish  # publish to npm
```

`@p6t/core`, `@p6t/lingui`, `@p6t/fbtee`, and `@p6t/cli` are published to npm. `apps/web` is private.

## Future

When native targets become a priority, `packages/core` is already runtime-agnostic — no changes needed. New packages (`react-native`, `swift`, `kotlin`) will depend on it. At that point, [moon](https://moonrepo.dev) is worth revisiting as a Turborepo replacement for its multi-language toolchain support.
