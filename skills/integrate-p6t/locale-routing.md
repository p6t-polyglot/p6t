# Locale selection by route type

Decide how users choose and retain their language before reorganizing routes. Preserve an established working policy; these are defaults for an app that has not chosen one, not a requirement to migrate every authenticated URL.

| Route type | Preferred source | Typical URL |
|---|---|---|
| Public/indexable | Explicit URL segment | `/de/about` |
| Private/authenticated | Saved user profile preference | `/dashboard` |
| Sign-in/sign-up | Last selected locale in a cookie, then default | `/login` |

Browser `Accept-Language` is a fallback for new visitors, not authority over an explicit URL or saved choice. Do not add profile database work when integrating only a catalog pipeline.

## Central locale model

Example `lib/locales.ts`, adapted to the agreed locales:

```ts
export const locales = ['en', 'de', 'fr'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && locales.some(locale => locale === value)
}
```

Validate URL segments, cookie values, and profile preferences at runtime. A TypeScript assertion such as `cookieValue as Locale` is not validation. Reject unsupported public segments or apply an agreed canonical redirect; use the default for invalid optional preferences. Load catalogs through an allowlist of supported locales.

Keep the i18n library, p6t source/targets, locale picker, and routing model aligned. A user timezone or billing currency is a separate preference from language.

## Next.js version and layout boundaries

Read documentation for the installed Next.js version before implementing. In Next.js 16, `params`, `cookies()`, and `headers()` are asynchronous; the network-boundary convention is `proxy.ts` / `proxy`. Use the matching convention for older projects rather than upgrading them as a side effect.

Keep `<html>` and `<body>` in the actual root layout(s), with the correct language and writing direction. Do not introduce nested document elements into an existing root. Plan mixed public/private/auth root layouts deliberately; do not move the entire app under `[locale]` just because a public-only example does so.

## Public pages

Read and validate the explicit locale segment before loading messages:

```tsx
// Within app/[locale]/layout.tsx, before rendering the provider:
const { locale } = await params
if (!isLocale(locale)) notFound()
const messages = await getMessages(locale)
```

The layout supplies `locale` and `messages` to the library's provider. Server-rendered message formatting uses the same selection. Where appropriate, `generateStaticParams` returns `locales.map(locale => ({ locale }))` to pre-render the supported segments.

Preserve locale when following public links and switching languages. Align canonical/alternate language metadata with the URL strategy when SEO is part of the scope. Do not redirect an explicitly localized URL to match a cookie or browser header.

For new unprefixed public visitors, a Next.js 16 proxy can negotiate a locale. Install `@formatjs/intl-localematcher`, `negotiator`, and the corresponding types only when needed:

```sh
pnpm add @formatjs/intl-localematcher negotiator
pnpm add -D @types/negotiator
```

Merge with existing auth/proxy behavior. Example with a deliberately narrow **illustrative public-route allowlist**:

```ts
import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'
import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale, locales } from './lib/locales'

function preferredLocale(request: NextRequest): string {
  const saved = request.cookies.get('p6t-locale')?.value
  if (isLocale(saved)) return saved

  const languages = new Negotiator({
    headers: { 'accept-language': request.headers.get('accept-language') ?? '' },
  }).languages().filter(language => language !== '*')

  try {
    return match(languages, [...locales], defaultLocale)
  } catch {
    return defaultLocale
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (locales.some(locale => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = `/${preferredLocale(request)}${pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/', '/about/:path*', '/pricing/:path*'],
}
```

Replace the matcher with the application's actual unprefixed public routes. Never copy a catch-all that redirects private pages, login, callbacks, APIs, framework paths, or assets. Preserve query strings and avoid redirect loops. If cookie/header-dependent redirects are cached, ensure they cannot serve one visitor's locale choice to another.

## Private pages

Use the existing authenticated layout/session fetch to obtain the saved locale. Validate it and fall back deliberately. Load messages for that locale and pass them through the provider; server formatting receives the same locale explicitly.

Do not add a second session/database fetch in the proxy just to choose a language. Use the app's existing preference update flow for an authenticated language picker. Do not invent a user schema, session API, or URL migration without agreement.

## Sign-in and sign-up

Without a signed-in profile, use the last selected language cookie. Next.js server-side selection:

```ts
import { cookies } from 'next/headers'
import { defaultLocale, isLocale } from '@/lib/locales'

export async function getAuthLocale() {
  const raw = (await cookies()).get('p6t-locale')?.value
  return isLocale(raw) ? raw : defaultLocale
}
```

Load messages and provide this locale through the auth layout. Cookie access makes the selection request-dependent; do not globally cache the resolved locale or messages independent of locale/user.

## Language switching and persistence

- Validate the selection against supported locales.
- For public pages, navigate to the equivalent locale-prefixed URL while preserving the relevant path/query.
- For authenticated pages, persist through the existing profile preference flow and refresh/activate the runtime locale.
- Update the locale cookie from both public and private language selection so later auth screens reflect the last choice. Set a suitable path (`/`) and the app's cookie security policy.
- In Next.js, write cookies in a Server Action/Route Handler or a response-producing proxy, not during Server Component rendering. Use `await cookies()` in actions/handlers.
- If direct visits to locale-prefixed public pages should also determine the next login language, synchronize the cookie in an appropriate response path; the URL remains authoritative for that public visit.
- Load the selected compiled catalog before activating the UI locale. Keep server and client selection consistent; update the document language/direction using the chosen root-layout architecture.

Test a fresh visitor, a returning visitor, a signed-in user, a locale switch followed by logout/login, unsupported segments, invalid cookies/preferences, and direct links. Confirm private/auth/API/assets are never locale-redirected accidentally, and that source and target locales do not leak across requests.
