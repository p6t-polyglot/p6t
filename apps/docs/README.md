# @p6t/docs

Nextra 4 documentation site for P6T.

## Development

```bash
pnpm install
pnpm dev        # Runs on http://localhost:3001
```

## Build

```bash
pnpm build      # Static export to dist/
```

## Project Structure

```
app/              # Next.js App Router
├── layout.tsx    # Root layout with Nextra theme
├── page.tsx      # Landing page (imports from content/)
└── docs/
    └── [[...mdx]]/    # Docs catch-all route (optional)

content/          # MDX documentation pages
├── _meta.ts      # Navigation configuration
├── index.mdx     # Landing page content
└── docs/         # Documentation section
    ├── _meta.ts
    ├── index.mdx
    ├── workflow.mdx
    ├── providers.mdx
    ├── ci.mdx
    └── api.mdx
```

## Technology

- **Nextra 4**: Documentation framework with App Router support
- **Next.js 15**: Static export for deployment
- **MDX**: Markdown with React components
