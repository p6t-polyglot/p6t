import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

export const pullCommand = defineCommand({
  meta: {
    name: 'pull',
    description: 'Pull confirmed translations from p6t web (coming soon)',
  },
  async run() {
    p.intro('p6t pull')
    p.log.warn('Web integration is not yet implemented.')
    p.outro('Nothing pulled.')
  },
})
