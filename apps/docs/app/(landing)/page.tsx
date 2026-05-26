import Link from "next/link";

export default function HomePage() {
  return (
    <div className="landing-canvas min-h-screen">
      <h1 className="font-mono text-4xl font-bold tracking-tight md:text-6xl mb-6">
        p6t
      </h1>

      <div className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mb-8 leading-relaxed">
        A CLI that generates native-quality translations for React apps. Uses
        your own LLM API key and works with react-intl and Lingui.
      </div>

      <div className="flex flex-wrap gap-4 mb-32">
        <Link
          href="/getting-started-react-intl"
          className="inline-flex items-center px-5 py-2.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-mono text-sm hover:opacity-80 transition-opacity"
        >
          Get started
        </Link>
        <a
          href="https://github.com/p6t/p6t"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-5 py-2.5 border border-neutral-300 dark:border-neutral-700 font-mono text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          GitHub
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-32">
        <div>
          <h3 className="font-mono font-semibold mb-2 text-sm">react-intl</h3>
          <div className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Works out of the box. The default.
          </div>
        </div>
        <div>
          <h3 className="font-mono font-semibold mb-2 text-sm">Lingui</h3>
          <div className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Experimental support available.
          </div>
        </div>
        <div>
          <h3 className="font-mono font-semibold mb-2 text-sm">
            Bring your own LLM
          </h3>
          <div className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            OpenAI, Anthropic, Google, Mistral, Ollama, OpenRouter.
          </div>
        </div>
      </div>

      <div className="text-2xl md:text-3xl font-light leading-snug max-w-3xl mb-32">
        No translation phase. No release blocking. No orphaned strings.
      </div>

      <div className="bg-neutral-900 text-neutral-100 p-6 font-mono text-sm mb-6 overflow-x-auto">
        <div className="space-y-1">
          <p>
            <span className="text-neutral-500 select-none">$ </span>pnpm add -D
            @p6t/cli
          </p>
          <p>
            <span className="text-neutral-500 select-none">$ </span>pnpm p6t
            init
          </p>
          <p>
            <span className="text-neutral-500 select-none">$ </span>pnpm p6t
            translate
          </p>
        </div>
      </div>

      <Link
        href="/getting-started-react-intl"
        className="font-mono text-sm hover:underline underline-offset-4"
      >
        Read the docs →
      </Link>
    </div>
  );
}
