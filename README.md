# p6t (polyglot)

p6t is a CLI that generates native-quality translations for React apps. Uses your own LLM API key and works with **react-intl** (default) and **Lingui** (experimental).

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

## How it works

p6t sends your missing translations directly to your LLM provider of choice (OpenAI, Gemini, etc.) and writes native-quality translation results back. It does this by first scaffolding a setup that includes a style guide of your brand voice, which you have full control over to customize it as your product matures, and then grouping related translations, so that closely related translations have an inner coherence.

For the result to sound really good, p6t requires context on your source strings, including the source file and a description of the translation that captures the intent of the element. If you're starting from scratch, I've written a compact guide on how to set up react-intl in your Next.js application.

All files are checked into the repository so you have full control over them. By building on top of react-intl, your coding agent will immediately know how to internationalize your app. You likely won't need any traditional translation management system (TMS) in the beginning, but if you want to use one, you can do that with any that supports react-intl, wich is most of them.

With p6t there should be zero reason not to launch multi-lingual from the very beginning.
