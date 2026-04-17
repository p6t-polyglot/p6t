import type { MDXComponents } from 'nextra/mdx-components'
import { useMDXComponents as getNextraComponents } from 'nextra/mdx-components'

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return getNextraComponents(components || {})
}
