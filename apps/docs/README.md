# @p6t/docs

Nextra 4 documentation site for p6t.

## Vercel Deployment

1. Create a new project in the [Vercel Dashboard](https://vercel.com/new)
2. Import the `p6t/p6t` repository
3. Set **Root Directory** to `apps/docs`
4. Framework Preset should auto-detect **Next.js**
5. Deploy

Vercel will automatically traverse up to the monorepo root to find `pnpm-lock.yaml` and install workspace dependencies.
