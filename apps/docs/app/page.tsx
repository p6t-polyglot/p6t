import Content from '../content/index.mdx'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-20">
      <article className="prose prose-slate dark:prose-invert max-w-none">
        <Content />
      </article>
    </div>
  )
}
