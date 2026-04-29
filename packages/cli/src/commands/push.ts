import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

export const pushCommand = defineCommand({
  meta: {
    name: 'push',
    description: 'Push translations to p6t web for review (coming soon)',
  },
  async run() {
    p.intro('p6t push')
    p.log.warn('Web integration is not yet implemented.')
    p.outro('Nothing pushed.')
  },
})
