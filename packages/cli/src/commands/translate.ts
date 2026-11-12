import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { getConfigDir, loadConfig } from "../config/loader.ts";
import { loadContext } from "../context/loader.ts";
import { createAdapter } from "../catalog/adapter.ts";
import { createModel } from "../llm/providers.ts";
import { DefaultTranslator } from "../llm/translator.ts";

interface CatalogSummary {
  locale: string;
  sourcePath: string;
  targetPath: string;
  pending: number;
  translated: number;
  missing: number;
  failed: number;
  removed: number;
  errors: string[];
}

export const translateCommand = defineCommand({
  meta: {
    name: "translate",
    description: "Translate missing strings in catalogs using an LLM",
  },
  args: {
    locale: {
      type: "string",
      description: "Only translate a specific target locale",
      alias: "l",
    },
    verbose: {
      type: "boolean",
      description: "Print raw LLM responses for debugging",
      default: false,
    },
    quiet: {
      type: "boolean",
      description: "Only print per-file summaries and diagnostics",
      alias: "q",
      default: false,
    },
    progress: {
      type: "boolean",
      description: "Show interactive progress in a TTY (disable with --no-progress)",
      default: true,
    },
    json: {
      type: "boolean",
      description: "Print one JSON summary without progress or raw responses",
      default: false,
    },
    "max-orphans": {
      type: "string",
      description:
        "Maximum number of orphaned (removed) translations to include as style context in each prompt",
      default: "50",
    },
  },
  async run({ args }) {
    const interactive = Boolean(process.stdout.isTTY) && args.progress && !args.quiet && !args.json;
    const summary: { files: CatalogSummary[]; errors: string[] } = { files: [], errors: [] };
    if (interactive) p.intro("p6t translate");

    try {
      const config = loadConfig();
      const configDir = getConfigDir();
      const targetLocales = args.locale ? [args.locale] : config.locale.targets;
      const maxOrphans = Number(args["max-orphans"]);
      if (!Number.isInteger(maxOrphans) || maxOrphans < 0) {
        throw new Error("Invalid --max-orphans value. Must be a non-negative integer.");
      }

      const model = createModel(config.provider);
      const translator = new DefaultTranslator(model, config.provider.prompt, undefined, maxOrphans);
      const adapter = await createAdapter(config, configDir);

      for (const targetLocale of targetLocales) {
        const ctx = loadContext(config, targetLocale, configDir);
        const catalogPaths = adapter.getCatalogPathsForLocale(targetLocale);
        const sourcePaths = adapter.getCatalogPathsForLocale(config.locale.source);

        for (let i = 0; i < catalogPaths.length; i++) {
          const targetPath = catalogPaths[i];
          const sourcePath = sourcePaths[i];
          if (!targetPath || !sourcePath) continue;

          const file: CatalogSummary = {
            locale: targetLocale, sourcePath, targetPath,
            pending: 0, translated: 0, missing: 0, failed: 0, removed: 0, errors: [],
          };
          summary.files.push(file);
          const orphans = adapter.removeStaleKeys(targetPath, sourcePath);
          file.removed = orphans.length;
          const pending = adapter.readPendingTranslations(targetPath, sourcePath);
          file.pending = pending.groups.reduce((sum, group) => sum + group.units.length, 0);
          const allResults: { id: string; translation: string }[] = [];

          for (const group of pending.groups) {
            if (group.units.length === 0) continue;

            const spinner = interactive ? p.spinner() : undefined;
            spinner?.start(`Translating ${group.units.length} strings in ${group.sourceFile} → ${targetLocale}`);
            try {
              const batch = await translator.translate(group, orphans, config.locale.source, targetLocale, ctx);
              allResults.push(...batch.results);
              file.missing += batch.missing.length;
              spinner?.stop(`Translated ${batch.results.length}/${group.units.length} strings in ${group.sourceFile} → ${targetLocale}`);

              if (batch.missing.length > 0 && args.verbose && !args.quiet && !args.json && batch.rawResponse) {
                process.stderr.write(`Raw LLM response:\n${batch.rawResponse}\n`);
              }
            } catch (err) {
              spinner?.stop(`Failed to translate ${group.sourceFile} → ${targetLocale}`);
              file.failed += group.units.length;
              file.errors.push(err instanceof Error ? err.message : String(err));
            }
          }

          if (allResults.length > 0) adapter.writeTranslations(targetPath, sourcePath, allResults);
          file.translated = allResults.length;
          if (!args.json) {
            const line = `${targetPath}: translated ${file.translated}/${file.pending}, missing ${file.missing}, failed ${file.failed}, removed ${file.removed}`;
            if (interactive) p.log.info(line);
            else process.stdout.write(`${line}\n`);
            for (const error of file.errors) {
              if (interactive) p.log.error(error);
              else process.stderr.write(`${error}\n`);
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(message);
      if (!args.json) {
        if (interactive) p.cancel(message);
        else process.stderr.write(`${message}\n`);
      }
    }

    const incomplete = summary.errors.length > 0 || summary.files.some(file => file.missing > 0 || file.failed > 0);
    if (incomplete) process.exitCode = 1;
    if (args.json) process.stdout.write(`${JSON.stringify(summary)}\n`);
    else if (interactive) p.outro(incomplete ? "Translation incomplete" : "Done");
  },
});
