import { defineCommand, runMain } from 'citty'
import { translateCommand } from './commands/translate.ts'
import { initCommand } from './commands/init.ts'
import { pushCommand } from './commands/push.ts'
import { pullCommand } from './commands/pull.ts'

const main = defineCommand({
  meta: {
    name: 'p6t',
    description: 'p6t — AI-powered translation pipeline',
    version: '0.0.0',
  },
  subCommands: {
    translate: translateCommand,
    init: initCommand,
    push: pushCommand,
    pull: pullCommand,
  },
})

runMain(main)
