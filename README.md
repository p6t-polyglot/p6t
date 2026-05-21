# p6t (polyglot)

p6t is a CLI that generates native-quality translations for React apps. Uses your own LLM API key and works with **react-intl** (default) and **Lingui** (experimental).

p6t is a CLI that produces native-quality translations for React apps on demand. Works with **react-intl** (default) and **Lingui** (experimental). Uses your own LLM API key — no external service required.

p6t is a CLI that generates native-quality translations for React apps. It connects your codebase to your own LLM API key for straightforward localization. Supports react-intl (default) and Lingui (experimental).

## Getting started

```sh
# Make sure the API key for the generative AI provider of your choice 
# is available in .env or provide it explicitly in the terminal. e.g.
# export GOOGLE_GENERATIVE_AI_API_KEY=your_key_here


# 1. Install as a dev dependency
pnpm add -D @p6t/cli

# 2. Initialize the config
pnpm p6t init

# 3. Run your first translation
pnpm p6t translate
```
