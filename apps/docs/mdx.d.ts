declare module '*.mdx' {
  const Component: React.ComponentType
  export default Component
}

declare module '*.css' {
  const css: string
  export default css
}
