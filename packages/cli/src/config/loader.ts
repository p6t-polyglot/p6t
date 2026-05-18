import fs from 'node:fs'
import path from 'node:path'
import { ConfigSchema, type Config } from '@p6t/core'

const CONFIG_FILE = 'i18n.json'

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** Walk up from cwd until we find i18n.json, or return null. */
function findConfigFile(startDir: string): string | null {
  let dir = startDir
  while (true) {
    const candidate = path.join(dir, CONFIG_FILE)
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** Load and validate i18n.json. Throws ConfigError on failure. */
export function loadConfig(cwd = process.cwd()): Config {
  const filePath = findConfigFile(cwd)
  if (!filePath) {
    throw new ConfigError(
      `No ${CONFIG_FILE} found. Run \`p6t init\` to create one.`,
    )
  }

  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    throw new ConfigError(`Failed to parse ${filePath}`)
  }

  const result = ConfigSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new ConfigError(`Invalid ${CONFIG_FILE}:\n${issues}`)
  }

  return result.data
}

/** Return the directory that contains i18n.json, or cwd if not found. */
export function getConfigDir(cwd = process.cwd()): string {
  const filePath = findConfigFile(cwd)
  return filePath ? path.dirname(filePath) : cwd
}

/** Resolve a context path template (replaces {locale}) against the config dir. */
export function resolveContextPath(
  template: string,
  locale: string,
  configDir: string,
): string {
  return path.resolve(configDir, template.replace('{locale}', locale))
}
