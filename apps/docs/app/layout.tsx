import { Head } from 'nextra/components'
import '../globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: {
    default: 'P6T - Continuous i18n for React',
    template: '%s | P6T'
  },
  description: 'Ship every feature in every language—automatically. No translation phase. No release blocking. No dead keys.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body className="min-h-screen bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
        <header className="fixed top-0 z-20 w-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
          <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <a href="/" className="text-xl font-bold">P6T</a>
            <div className="flex items-center gap-6">
              <a 
                href="/docs" 
                className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                Documentation
              </a>
              <a 
                href="https://github.com/p6t/p6t" 
                target="_blank" 
                rel="noreferrer"
                className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                GitHub
              </a>
            </div>
          </nav>
        </header>
        <main className="pt-16">
          {children}
        </main>
        <footer className="border-t border-neutral-200 dark:border-neutral-800 py-8 mt-16">
          <div className="mx-auto max-w-7xl px-6 text-sm text-neutral-600 dark:text-neutral-400">
            MIT {new Date().getFullYear()} © P6T
          </div>
        </footer>
      </body>
    </html>
  )
}
