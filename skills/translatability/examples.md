# Translatability examples

The principles are library-independent. These examples use react-intl and Lingui without hand-written catalog IDs; the matching build transform and extractor must be configured.

## Source and intent stay together

Avoid `t('projects.delete')`: the caller hides both the wording and the consequence behind a key. Prefer a message at its usage site:

```tsx
import { FormattedMessage } from 'react-intl'

<FormattedMessage
  defaultMessage="Delete {projectName}"
  description="Action in the project menu. Opens a confirmation dialog; does not delete immediately. {projectName} is the project's display name."
  values={{ projectName }}
/>
```

The confirmation dialog's final destructive action needs its own message and description, even if the English wording happens to match.

## Explicit code sharing, not implicit catalog sharing

If the same domain action appears in several places, share the actual component, such as `DeleteProjectButton`. That keeps behavior, wording, and intent together.

When consumers need a string rather than a component, a shared message descriptor is an ordinary code dependency:

```ts
// account-messages.ts
import { defineMessage } from 'react-intl'

export const deleteAccountConfirmation = defineMessage({
  defaultMessage: 'Permanently delete account',
  description: 'Final confirmation action for deleting the signed-in account. Cannot be undone.',
})
```

```tsx
// A consumer inside a React component
const intl = useIntl()
const label = intl.formatMessage(deleteAccountConfirmation)
```

Consumers import `deleteAccountConfirmation`; they do not know or repeat its generated ID. Both extraction and runtime transforms must process the defining module. A shared descriptor is an exception for genuine reuse, not a reason to move every message away from its component.

For a domain value with several presentations, share a typed function containing static messages:

```ts
import type { IntlShape } from 'react-intl'

export function paymentStatusLabel(
  intl: IntlShape,
  status: 'paid' | 'due',
): string {
  switch (status) {
    case 'paid':
      return intl.formatMessage({
        defaultMessage: 'Paid',
        description: 'Invoice payment status. The full amount has been received.',
      })
    case 'due':
      return intl.formatMessage({
        defaultMessage: 'Payment due',
        description: 'Invoice payment status. An outstanding balance remains.',
      })
  }
}
```

Call the helper with the active formatter during rendering. Keep `'paid'` and `'due'` stable in storage and APIs. Do not replace the switch with `t('payment.' + status)`.

Do not translate constants at module initialization or memoize labels without a locale dependency. After switching language, the same code should produce the newly selected language.

## Same wording, different meanings

An “Open” button opens an existing project. An “Open” badge means a support ticket has not been resolved. They are not a shared domain concept.

Give each its own intent. With react-intl, distinct descriptions participate in the standard generated-ID scheme. With Lingui, use semantic `context` to disambiguate when required; `comment` explains intent to translators but is not an identity boundary.

Do not force both into `common.open`, or change wording merely to manipulate generated IDs.

## Complete messages and plurals

Avoid `count + ' ' + t('item') + ' ' + t('inCart')`. Even translating the noun separately cannot express language-specific word order and inflection.

```tsx
<FormattedMessage
  defaultMessage="{count, plural, =0 {Your cart is empty.} one {You have # item in your cart.} other {You have # items in your cart.}}"
  description="Cart summary above checkout. {count} is the number of items currently in the cart."
  values={{ count }}
/>
```

`=0` is an exact count; `zero` is a language-dependent plural category. Write the source language's categories and let translations supply the categories appropriate to each target locale. Check zero, one, and representative other counts rather than implementing English plural logic in JavaScript.

## Rich text stays inside the message

```tsx
<FormattedMessage
  defaultMessage="Read the <terms>terms of service</terms> before continuing."
  description="Notice above account creation. The link opens the terms governing use of the product."
  values={{
    terms: chunks => <a href="/terms">{chunks}</a>,
  }}
/>
```

The translator can reposition the linked phrase. The application still owns its destination and safe rendering; do not concatenate translated text around a link or let translations supply executable markup.

## Lingui: generated IDs, comments, and explicit reuse

```tsx
import { Trans } from '@lingui/react/macro'

<Trans
  context="project-menu-action"
  comment="Action in the project menu. Opens the project in the editor."
>
  Open
</Trans>
```

Use `context` for semantic disambiguation, not as a manually maintained global key namespace. A status with the same source word gets its own context.

```ts
// account-messages.ts
import { msg } from '@lingui/core/macro'

export const deleteAccountConfirmation = msg({
  message: 'Permanently delete account',
  comment: 'Final confirmation action for deleting the signed-in account. Cannot be undone.',
})
```

Consumers import the descriptor and resolve it with their active `i18n._(deleteAccountConfirmation)`. In React, obtain the instance through `useLingui()` so locale changes cause rendering; on the server, use the request's instance. Use imports supported by the installed Lingui version.

## Formatting is not translation by concatenation

Use `intl.formatNumber(amount, { style: 'currency', currency })` or `new Intl.NumberFormat(locale, { style: 'currency', currency })`, then interpolate into the complete message where necessary. The account's billing currency is not inferred from its selected language.

Format dates with the active locale and the intended timezone. Keep server and client formatting inputs aligned. Do not insert currency symbols manually, slice date strings, or turn one translated label into another through casing changes.

## Review beyond the happy path

For a checkout form, review the submit label, pending label, empty cart, validation errors, failed-payment toast, success screen, image descriptions, and accessible control names. Translate product-authored presentation, not a payment provider's machine status codes or the customer's own text.

Try a locale with longer text; change locale after the form has rendered. Check that shared labels update, plurals format correctly, focus remains usable, and no translated text becomes a persistence or routing identifier.
