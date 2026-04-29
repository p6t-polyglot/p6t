import path from 'node:path'
import { getConfig } from '@lingui/conf'

export interface LinguiCatalogPath {
  /** Absolute path to the .po file for the given locale (no extension). */
  path: string
}

export interface LinguiProject {
  rootDir: string
  locales: string[]
  catalogPaths: LinguiCatalogPath[]
}

/** Load the lingui config from cwd. Returns null if no lingui config is found. */
export function loadLinguiConfig(cwd = process.cwd()): LinguiProject | null {
  try {
    const config = getConfig({ cwd, skipValidation: true })
    return {
      rootDir: config.rootDir,
      locales: config.locales,
      catalogPaths: config.catalogs.map((catalog) => ({
        path: catalog.path,
      })),
    }
  } catch {
    return null
  }
}

/**
 * Resolve a lingui catalog path template to an absolute .po file path.
 * Replaces `<rootDir>` and `{locale}` placeholders.
 */
export function resolveCatalogPath(
  template: string,
  locale: string,
  rootDir: string,
): string {
  const resolved = template
    .replace('<rootDir>', rootDir)
    .replace('{locale}', locale)
  return path.resolve(resolved + '.po')
}

/**
 * Given a lingui project and a locale, return all .po file paths for that locale.
 */
export function getCatalogPathsForLocale(
  project: LinguiProject,
  locale: string,
): string[] {
  return project.catalogPaths.map((catalog) =>
    resolveCatalogPath(catalog.path, locale, project.rootDir),
  )
}
