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

    const translator = new DefaultTranslator(model, config.provider.prompt);

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

        const units = adapter.readUntranslated(targetPath, sourcePath);

        if (units.length === 0) {
          p.log.info(`${targetLocale}: already up to date`);
          continue;
        }

        const spinner = p.spinner();
        spinner.start(
          `Translating ${units.length} string${units.length === 1 ? "" : "s"} → ${targetLocale}`,
        );

        try {
          const batch = await translator.translate(
            units,
            config.locale.source,
            targetLocale,
            ctx,
          );

          // Stop spinner before any output that might interleave
          spinner.stop(
            `Translated ${batch.results.length}/${units.length} strings → ${targetLocale}`,
          );

          adapter.writeTranslations(targetPath, sourcePath, batch.results);

          if (batch.missing.length > 0) {
            p.log.warn(
              `${batch.missing.length} string${batch.missing.length === 1 ? "" : "s"} not returned by the LLM:`,
            );
            for (const unit of batch.missing) {
              const preview =
                unit.source.length > 60
                  ? unit.source.slice(0, 60) + "…"
                  : unit.source;
              p.log.warn(`  • ${unit.id}: "${preview}"`);
            }

            if (args.verbose && batch.rawResponse) {
              p.log.info("Raw LLM response:");
              process.stdout.write(batch.rawResponse + "\n");
            }
          }
        } catch (err) {
          spinner.stop(`Failed to translate → ${targetLocale}`);
          p.log.error(err instanceof Error ? err.message : String(err));
        }
      }
    }

    p.outro("Done");
  },
});
