---
name: translatability
description: Guides source-first, translator-friendly UI and generated-artifact development and review. Use when changing user-facing text, separating document language from viewer chrome, reviewing localization, or sharing messages through code rather than hand-written translation keys. Applies with or without React or p6t.
---

# Translatability

Application code owns meaning and reuse. Translation catalogs hold translations, not application architecture.

## Quick start

Declare the source message and its intent where it is used. Let the toolchain generate catalog IDs. For example, with react-intl:

```tsx
<FormattedMessage
  defaultMessage="Save changes"
  description="Primary action in the profile settings form. Saves all pending edits."
/>
```

Use the project's i18n library and extraction conventions. This skill does not require p6t.

## Workflow

1. Inspect the repo instructions, i18n configuration, representative components, and scripts until the library, message conventions, and extraction/build path are identified.
2. Establish the changed surface's user goal, message placement, action consequences, and language owner (artifact, viewer, or model-facing). Ask about intent that the code does not establish.
3. Apply the principles below to every changed user-facing surface, including loading, empty, error, and accessible states.
4. Complete the verification checklist; report any blocked checks explicitly.

If no i18n infrastructure exists, agree on a setup before introducing translation APIs. Do not silently migrate a repo's library or ID scheme, rewrite unrelated messages, or add a translation service.

## Principles

### Source messages, not magic keys

- Use generated IDs instead of hand-written catalog keys such as `common.save`. Code should reveal the source wording and intent without opening a catalog.
- Keep generated hashes private to the toolchain. Link application behavior through code symbols, not copied catalog IDs.
- Colocate messages at their usage site by default; extract into shared code for genuine reuse. Keep declarations statically visible to extraction and the chosen ID-resolution path.
- In a key-based codebase, explain the source-first direction and agree on migration separately; preserve the existing contract until then.

### Share meaning through code

- When two places genuinely express the same domain concept, share a component, function, or message descriptor through ordinary imports and symbol references.
- Make sharing discoverable through ordinary symbol references, not a string-key registry disguised as a helper.
- Identical source wording does not imply identical meaning. An “Open” action and an “Open” status are separate messages with separate context.
- **FormatJS** (`react-intl` or `@formatjs/intl`): generated IDs hash source text and `description`. Same text + different descriptions → distinct IDs; same text + same description → intentionally one message. An absent and an empty description are equivalent for identity.
- **Lingui:** use `context` to disambiguate meaning. Its translator `comment` does not affect generated identity.
- Share definitions, not module-level translated strings. Resolve them with the owning locale at render/export time, and remain reactive to changes of that locale.

### Capture intent at write-time

- Give every message a statically extractable description/comment: placement, user goal, effect, stakes, and any ambiguous terminology or placeholders.
- “Button text” or a paraphrase of the source is not useful context. “Opens a confirmation dialog; does not delete immediately” is.
- Keep descriptions accurate when behavior changes. Product briefs, per-locale voice guides, and glossaries supplement message-level intent; they do not replace it.

### Translate complete messages

- Use a complete grammatical unit, including punctuation. A short button label can be a complete message; fragments of a sentence are not.
- Never concatenate translated fragments, append English suffixes, or assemble dynamic translation keys. Let translators reorder meaningful placeholders and rich-text elements.
- Use ICU plurals/selects or the library equivalent, with an `other` fallback. Do not model all languages with `count === 1`, or assume that the plural category `zero` means exactly zero.
- Keep source text static for extraction. Pass data as named placeholders; explain what each ambiguous value represents. Preserve placeholder names in translations.
- Write the complete message for each grammatical context instead of lowercasing, capitalizing, or inflecting an already translated label to fit another sentence.
- Use safe rich-text interpolation rather than translated HTML passed to an unsafe renderer.

### Respect locale and presentation

- Format dates, times, numbers, currencies, lists, and units with locale-aware APIs using the active locale. Specify timezone and currency from product/user data, not guesses based on language.
- Include headings, buttons, menus, placeholders, tooltips, validation, errors, toasts, metadata, and screen-reader text. Keep intentionally empty decorative `alt` text empty.
- Keep database values, enum members, protocol fields, and machine identifiers stable; translate their presentation at the UI boundary.
- Allow text expansion and different writing directions with layouts and icons that suit the active language.
- Keep locale-specific formatters isolated to their owner: request-scoped for viewer SSR, document/export-scoped for artifacts. Reuse formatter caches, not a mutable global locale; align viewer SSR with client hydration.

### Separate language owners

Ask **“Would this string still be in an exported PDF or image?”**

| Owner | Examples | Language source |
|---|---|---|
| Artifact text | Plan legend, dimensions, PDF/image title | Stored document/project language |
| Viewer chrome | Toolbar, statuses, accessible names, walkthrough controls | Client/host preference, query parameter, or browser locale |
| Model-facing text | Prompts, tool descriptions, model-consumed errors/warnings | English |

Persist artifact language as document data; validate it when creating/loading a document and pass it explicitly to renderers/exporters. Reopening/exporting the same stored document must not adopt the current viewer's language. Language changes to the artifact are explicit document edits. Set `lang` on generated SVG/HTML (and direction when applicable); client chrome can have a different language.

Localize user-visible errors at the presentation boundary, while preserving English model-facing diagnostics and stable machine codes. Do not translate prompts or tool schemas as a side effect of localizing the UI.

## Verification

- [ ] New and changed messages extract with source text, intent, and available source references; shared definitions are extracted too.
- [ ] Same-text/different-description FormatJS messages generate different IDs. A no-transform setup fails tests for descriptors missing from its generated-ID map.
- [ ] No new magic keys, sentence fragments, unlocalized UI states, or stale pretranslated constants.
- [ ] Placeholders and ICU syntax compile; required translations are present rather than merely hidden by fallback.
- [ ] Test the source locale and a target locale: plural boundaries, long text, accessible names, formatting, and switching locale without stale text. Check RTL when supported.
- [ ] Review catalog diffs; do not overwrite human translations or prune against an incomplete extraction.
- [ ] Switching viewer language leaves document data and exported wording unchanged; re-export uses stored artifact language and correct SVG/HTML `lang`.

Run the repo's pipeline where available. Obtain permission before sending strings/context to a provider or incurring translation costs. Never fabricate translations or claim a check passed when credentials or infrastructure are missing.

When choosing a reuse boundary, designing plurals/rich text, or needing library syntax, read [examples.md](examples.md) for concrete react-intl/Lingui examples.
