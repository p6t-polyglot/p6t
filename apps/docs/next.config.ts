import nextra from 'nextra'
import type { NextConfig } from 'next'

const withNextra = nextra({
  contentDirBasePath: '/docs',
})

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
}

export default withNextra(nextConfig)
