# @p6t/core

Framework-agnostic translation engine for p6t.

> **Status:** Work in progress — API not stable.

## What this package does

`@p6t/core` handles the runtime logic that doesn't depend on any framework or rendering environment:

- Locale detection and resolution
- Config loading and namespace management
- Chunk/lazy loading of translation payloads
- Pluralisation rules

It has **no dependency on React, fbtee, or any JSX runtime**. This is what makes future native SDKs (`react-native`, Swift, Kotlin) possible — they'll all build on this package.

## What this package does NOT do

- No `<fbt>` JSX components — those live in `@p6t/react`
- No UI, no rendering, no framework assumptions

## Installation

```bash
pnpm add @p6t/core
```

## Usage

> TBD — API is not yet defined.

## Build

```bash
pnpm build   # tsup → dist/
pnpm dev     # watch mode
```
