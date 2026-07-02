---
"@p6t/cli": minor
---

Restore `.env` loading and make `init` a real update flow.

Two papercuts surfaced once the CLI moved from a bundled Bun executable to plain Node. Bun had been quietly loading `.env` files for you, so when that magic disappeared, provider API keys kept in a `.env`/`.env.local` silently stopped being found — the kind of failure that makes you doubt your own keys. The CLI now loads them itself, matching Bun's precedence (shell environment wins, then `.env.local` over `.env`), so nothing exported in your shell is ever clobbered.

Re-running `p6t init` used to greet you with a scary "overwrite?" prompt and then throw away everything you'd already configured. Now it treats an existing `i18n.json` as the starting point: every prompt is pre-filled with your current values and you simply step through and tweak what changed.
