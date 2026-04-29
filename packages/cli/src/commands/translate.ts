import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { ConfigError, getConfigDir, loadConfig } from "../config/loader.ts";
import { loadContext } from "../context/loader.ts";
import {
  getCatalogPathsForLocale,
  loadLinguiConfig,
} from "../lingui/config.ts";
import { readUntranslated, writeTranslations } from "../lingui/catalog.ts";
import { createModel, ProviderError } from "../llm/providers.ts";
import { DefaultTranslator } from "../llm/translator.ts";

export const translateCommand = defineCommand({
  meta: {
    name: "translate",
    description: "Translate missing strings in lingui catalogs using an LLM",
  },
  args: {
    locale: {
      type: "string",
      description: "Only translate a specific target locale",
      alias: "l",
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

    // Load lingui project
    const linguiProject = loadLinguiConfig(configDir);
    if (!linguiProject) {
      p.cancel(
        "No lingui config found. Make sure lingui.config.ts (or equivalent) exists.",
      );
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

    const translator = new DefaultTranslator(model, config.provider.prompt);

    // Process each target locale
    for (const targetLocale of targetLocales) {
      const ctx = loadContext(config, targetLocale, configDir);
      const catalogPaths = getCatalogPathsForLocale(
        linguiProject,
        targetLocale,
      );
      const sourcePaths = getCatalogPathsForLocale(
        linguiProject,
        config.locale.source,
      );

      for (let i = 0; i < catalogPaths.length; i++) {
        const targetPath = catalogPaths[i];
        const sourcePath = sourcePaths[i];

        if (!targetPath || !sourcePath) continue;

        const units = readUntranslated(targetPath, sourcePath);

        if (units.length === 0) {
          p.log.info(`${targetLocale}: already up to date`);
          continue;
        }

        const spinner = p.spinner();
        spinner.start(
          `Translating ${units.length} string${units.length === 1 ? "" : "s"} → ${targetLocale}`,
        );

        try {
          const results = await translator.translate(
            units,
            config.locale.source,
            targetLocale,
            ctx,
          );
          writeTranslations(targetPath, sourcePath, results);
          spinner.stop(
            `Translated ${results.length}/${units.length} strings → ${targetLocale}`,
          );
        } catch (err) {
          spinner.stop(`Failed to translate → ${targetLocale}`);
          p.log.error(err instanceof Error ? err.message : String(err));
        }
      }
    }

    p.outro("Done");
  },
});
