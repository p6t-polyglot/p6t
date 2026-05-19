import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { ConfigError, getConfigDir, loadConfig } from "../config/loader.ts";
import { loadContext } from "../context/loader.ts";
import { createAdapter } from "../catalog/adapter.ts";
import { createModel, ProviderError } from "../llm/providers.ts";
import { DefaultTranslator } from "../llm/translator.ts";

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
    "max-orphans": {
      type: "string",
      description:
        "Maximum number of orphaned (removed) translations to include as style context in each prompt",
      default: "50",
    },
  },
  async run({ args }) {
    p.intro("p6t translate");

    // Load config
    let config;
    try {
      config = loadConfig();
    } catch (err) {
      if (err instanceof ConfigError) {
        p.cancel(err.message);
        process.exit(1);
      }
      throw err;
    }

    const configDir = getConfigDir();

    // Determine which locales to translate
    const targetLocales = args.locale ? [args.locale] : config.locale.targets;

    // Parse max-orphans
    const maxOrphans = parseInt(args["max-orphans"], 10);
    if (Number.isNaN(maxOrphans) || maxOrphans < 0) {
      p.cancel("Invalid --max-orphans value. Must be a non-negative integer.");
      process.exit(1);
    }

    // Build model + translator
    let model;
    try {
      model = createModel(config.provider);
    } catch (err) {
      if (err instanceof ProviderError) {
        p.cancel(err.message);
        process.exit(1);
      }
      throw err;
    }

    const translator = new DefaultTranslator(
      model,
      config.provider.prompt,
      undefined,
      maxOrphans,
    );

    // Load catalog adapter
    let adapter;
    try {
      adapter = await createAdapter(config, configDir);
    } catch (err) {
      p.cancel(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    // Process each target locale
    for (const targetLocale of targetLocales) {
      const ctx = loadContext(config, targetLocale, configDir);
      const catalogPaths = adapter.getCatalogPathsForLocale(targetLocale);
      const sourcePaths = adapter.getCatalogPathsForLocale(
        config.locale.source,
      );

      for (let i = 0; i < catalogPaths.length; i++) {
        const targetPath = catalogPaths[i];
        const sourcePath = sourcePaths[i];

        if (!targetPath || !sourcePath) continue;

        // 1. Remove stale keys and capture orphan metadata
        const orphans = adapter.removeStaleKeys(targetPath, sourcePath);
        if (orphans.length > 0) {
          p.log.info(
            `Removed ${orphans.length} stale string${orphans.length === 1 ? "" : "s"} from ${targetLocale}`,
          );
          for (const orphan of orphans) {
            p.log.info(`  • ${orphan.id}: "${orphan.source}"`);
          }
        }

        // 2. Read grouped catalog state
        const pending = adapter.readPendingTranslations(targetPath, sourcePath);
        const totalUnits = pending.groups.reduce(
          (sum, g) => sum + g.units.length,
          0,
        );

        // Warn when source-file references are missing
        if (
          pending.groups.some((g) => g.hasSourceRefs === false && g.units.length > 0)
        ) {
          p.log.warn(
            "Source file references not found in catalog. Translations will be grouped by catalog file instead of by component. For better results, run `formatjs extract` with `--extract-source-location`.",
          );
        }

        if (totalUnits === 0) {
          if (orphans.length === 0) {
            p.log.info(`${targetLocale}: already up to date`);
          }
          continue;
        }

        // 3. Translate each group, accumulating results
        const allResults: { id: string; translation: string }[] = [];
        const allMissing: { id: string; source: string }[] = [];
        let lastRawResponse: string | undefined;

        for (const group of pending.groups) {
          if (group.units.length === 0) continue;

          const contextLabel = group.sourceFile;

          const spinner = p.spinner();
          spinner.start(
            `Translating ${group.units.length} string${group.units.length === 1 ? "" : "s"} in ${contextLabel} → ${targetLocale}`,
          );

          try {
            const batch = await translator.translate(
              group,
              orphans,
              config.locale.source,
              targetLocale,
              ctx,
            );

            spinner.stop(
              `Translated ${batch.results.length}/${group.units.length} strings in ${contextLabel} → ${targetLocale}`,
            );

            allResults.push(...batch.results);
            allMissing.push(...batch.missing);
            if (batch.rawResponse) {
              lastRawResponse = batch.rawResponse;
            }
          } catch (err) {
            spinner.stop(
              `Failed to translate ${contextLabel} → ${targetLocale}`,
            );
            p.log.error(err instanceof Error ? err.message : String(err));
          }
        }

        // 4. Write accumulated results back once per catalog
        if (allResults.length > 0) {
          adapter.writeTranslations(targetPath, sourcePath, allResults);
        }

        // 5. Report missing translations across all groups
        if (allMissing.length > 0) {
          p.log.warn(
            `${allMissing.length} string${allMissing.length === 1 ? "" : "s"} not returned by the LLM:`,
          );
          for (const unit of allMissing) {
            const preview =
              unit.source.length > 60
                ? unit.source.slice(0, 60) + "…"
                : unit.source;
            p.log.warn(`  • ${unit.id}: "${preview}"`);
          }

          if (args.verbose && lastRawResponse) {
            p.log.info("Raw LLM response:");
            process.stdout.write(lastRawResponse + "\n");
          }
        }
      }
    }

    p.outro("Done");
  },
});
