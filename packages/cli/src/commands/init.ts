import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { generateText } from "ai";
import { createModel, ProviderError } from "../llm/providers.ts";
import { createAdapter } from "../catalog/adapter.ts";
import type { Config } from "@p6t/core";

const CONFIG_FILE = "i18n.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TranslationPair {
  source: string;
  translation: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeFileSafe(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function readFileSafe(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
}

function resolveContextPath(
  template: string,
  locale: string,
  cwd: string,
): string {
  return path.resolve(cwd, template.replace("{locale}", locale));
}

function detectFormatFromFiles(cwd: string): "lingui" | "react-intl" | null {
  // Prefer .po files (Lingui)
  for (const dir of ["locale", "locales", "src/locales", "src/locale"]) {
    const full = path.join(cwd, dir);
    if (!fs.existsSync(full)) continue;
    for (const entry of fs.readdirSync(full, { recursive: true }) as string[]) {
      if (entry.endsWith(".po")) return "lingui";
    }
  }

  // Check for JSON catalogs with defaultMessage keys (react-intl source)
  for (const dir of [
    "lang",
    "src/lang",
    "messages",
    "src/messages",
    "i18n",
    "locales",
    "src/locales",
    "src/i18n",
  ]) {
    const full = path.join(cwd, dir);
    if (!fs.existsSync(full)) continue;
    for (const entry of fs.readdirSync(full, { recursive: true }) as string[]) {
      if (!entry.endsWith(".json")) continue;
      const raw = readFileSafe(path.join(full, entry));
      if (!raw) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null) {
          const values = Object.values(parsed as Record<string, unknown>);
          if (
            values.some(
              (v) =>
                typeof v === "object" &&
                v !== null &&
                "defaultMessage" in v,
            )
          ) {
            return "react-intl";
          }
        }
      } catch {
        // ignore malformed JSON
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// LLM-assisted draft generators
// ---------------------------------------------------------------------------

async function draftDescription(
  readme: string | undefined,
  sourceStrings: string[],
  model: ReturnType<typeof createModel>,
): Promise<string> {
  const sample = sourceStrings.join("\n");
  const prompt = [
    "Write a concise project description (2-4 paragraphs) for a professional translator.",
    "It should explain: what this product is, who uses it, its domain/industry, and any important vocabulary notes.",
    "Base it on the README and sample UI strings below.",
    readme ? `\n## README\n${readme.slice(0, 100_000)}` : "",
    sample ? `\n## Sample UI strings\n${sample}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateText({
    model,
    system:
      "You are a localization consultant writing a project brief for professional translators. Be clear and practical.",
    prompt,
  });
  return text.trim();
}

async function draftStyleGuide(
  locale: string,
  projectDescription: string,
  translatedPairs: TranslationPair[],
  model: ReturnType<typeof createModel>,
): Promise<string> {
  const examplesSection =
    translatedPairs.length > 0
      ? `\n## Existing translations (observe the established style)\n${translatedPairs
          .map(
            ({ source, translation }) =>
              `source: ${source}\ntranslation: ${translation}`,
          )
          .join("\n\n")}`
      : "";

  const { text } = await generateText({
    model,
    system:
      "You are a localization expert. Write a translation style guide in markdown.",
    prompt: [
      `Write a style guide for translating into ${locale}.`,
      "Cover: formality level (formal/informal), tone, brand voice, punctuation conventions, number/date formats, and any locale-specific considerations.",
      "Keep it practical — 1-2 sentences per rule. Use markdown headings.",
      "If existing translations are provided, infer the style from them rather than guessing.",
      `\n## Project context\n${projectDescription}`,
      examplesSection,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  return text.trim();
}

async function draftGlossary(
  locale: string,
  sourceStrings: string[],
  projectDescription: string,
  translatedPairs: TranslationPair[],
  styleGuide: string,
  model: ReturnType<typeof createModel>,
): Promise<Record<string, string>> {
  const sample = sourceStrings.join("\n");
  const existingSection =
    translatedPairs.length > 0
      ? `\n## Existing translations (extract consistent term mappings from these)\n${translatedPairs
          .map(
            ({ source, translation }) =>
              `source: ${source}\ntranslation: ${translation}`,
          )
          .join("\n")}`
      : "";

  const { text } = await generateText({
    model,
    system:
      "You are a localization expert. Respond with valid JSON only — a flat object mapping English terms to their preferred translations. No markdown, no explanation.",
    prompt: [
      `Identify the most important domain-specific terms and provide their preferred ${locale} translations. This just needs to be enough for a smart translator to be able to consistenly translate the UI — shorter is better.`,
      "If existing translations are provided, extract term mappings directly from them — prefer attested translations over guesses.",
      `\n## Project context\n${projectDescription}`,
      `\n## Style guide\n${styleGuide}`,
      sample ? `\n## Source UI strings\n${sample}` : "",
      existingSection,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  try {
    const cleaned = text
      .replace(/^```[a-z]*\n?/m, "")
      .replace(/```$/m, "")
      .trim();
    const parsed: unknown = JSON.parse(cleaned);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).flatMap(([k, v]) =>
          typeof v === "string" ? [[k, v]] : [],
        ),
      );
    }
  } catch {
    // Fallback to empty — user can fill it in manually
  }
  return {};
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Scaffold i18n.json and translation context files",
  },
  async run() {
    p.intro("p6t init");

    const cwd = process.cwd();

    if (fs.existsSync(path.join(cwd, CONFIG_FILE))) {
      const overwrite = await p.confirm({
        message: `${CONFIG_FILE} already exists. Overwrite?`,
        initialValue: false,
      });
      if (p.isCancel(overwrite) || !overwrite) {
        p.cancel("Aborted.");
        process.exit(0);
      }
    }

    // ── Prompts ──────────────────────────────────────────────────────────────

    const detectedFormat = detectFormatFromFiles(cwd);

    const answers = await p.group(
      {
        sourceLocale: () =>
          p.text({
            message: "Source locale (language your strings are written in)",
            placeholder: "en",
            defaultValue: "en",
          }),
        targetLocales: () =>
          p.text({
            message: "Target locales (comma-separated)",
            placeholder: "de, fr, es",
            validate: (v) =>
              (v ?? "").trim()
                ? undefined
                : "At least one target locale is required",
          }),
        providerId: () =>
          p.select({
            message: "LLM provider",
            options: [
              { value: "openai", label: "OpenAI" },
              { value: "anthropic", label: "Anthropic" },
              { value: "google", label: "Google" },
              { value: "mistral", label: "Mistral" },
              { value: "ollama", label: "Ollama (local)" },
              { value: "openrouter", label: "OpenRouter" },
            ],
          }),
        model: () =>
          p.text({
            message: "Model name",
            placeholder: "gpt-4o",
            validate: (v) =>
              (v ?? "").trim() ? undefined : "Model name is required",
          }),
        format: () =>
          p.select({
            message: "Translation library / catalog format",
            initialValue: detectedFormat,
            options: [
              { value: "lingui", label: "Lingui (.po)" },
              { value: "react-intl", label: "react-intl / FormatJS (.json)" },
            ],
          }),
        catalogPath: ({ results }: { results: Record<string, unknown> }) => {
          if (results.format !== "react-intl") return undefined;
          return p.text({
            message: "Catalog path template (use {locale} placeholder)",
            placeholder: "i18n/{locale}.json",
            validate: (v) => {
              if (!(v ?? "").trim()) return "Catalog path is required";
              if (!(v as string).includes("{locale}"))
                return "Path must contain {locale}";
              return undefined;
            },
          });
        },
        draftContext: () =>
          p.confirm({
            message:
              "Use the LLM to draft description, style guides, and glossaries? (requires API key)",
            initialValue: true,
          }),
      },
      {
        onCancel: () => {
          p.cancel("Aborted.");
          process.exit(0);
        },
      },
    );

    const targetLocales = (answers.targetLocales as string)
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    const providerId = answers.providerId as Config["provider"]["id"];
    const model = answers.model as string;
    const sourceLocale = answers.sourceLocale as string;
    const format = answers.format as Config["format"];
    const draftContext = answers.draftContext as boolean;
    const catalogPath = answers.catalogPath as string | undefined;

    // ── Write i18n.json ──────────────────────────────────────────────────────

    const config: Config = {
      version: 1,
      format,
      locale: { source: sourceLocale, targets: targetLocales },
      provider: { id: providerId, model },
      context: {
        description: "i18n/description.md",
        styleGuide: "i18n/{locale}/style-guide.md",
        glossary: "i18n/{locale}/glossary.json",
      },
    };

    if (format === "react-intl" && catalogPath) {
      config.catalogs = [{ path: catalogPath }];
    }

    writeFileSafe(
      path.join(cwd, CONFIG_FILE),
      JSON.stringify(
        { $schema: "https://p6t.dev/schema/i18n.json", ...config },
        null,
        2,
      ) + "\n",
    );
    p.log.success(`Created ${CONFIG_FILE}`);

    // ── Set up adapter ───────────────────────────────────────────────────────

    let adapter;
    try {
      adapter = await createAdapter(config, cwd);
    } catch (err) {
      p.log.warn(
        `Could not load catalog adapter (${err instanceof Error ? err.message : String(err)}) — skipping LLM drafting.`,
      );
      writeContextStubs(cwd, config, targetLocales);
      p.outro("Done (stubs created)");
      return;
    }

    // ── LLM-assisted context drafting ────────────────────────────────────────

    if (draftContext) {
      let llmModel: ReturnType<typeof createModel>;
      try {
        llmModel = createModel({ id: providerId, model });
      } catch (err) {
        if (err instanceof ProviderError) {
          p.log.warn(
            `${err.message} — skipping LLM drafting. Edit context files manually.`,
          );
          writeContextStubs(cwd, config, targetLocales);
          p.outro("Done (stubs created)");
          return;
        }
        throw err;
      }

      const spinner = p.spinner();

      // Collect context for LLM
      const readme = readFileSafe(path.join(cwd, "README.md"));
      const allCatalogs = adapter.discoverCatalogs(cwd);
      const sourceCatalogs = allCatalogs.filter(
        (f) =>
          f.includes(`/${sourceLocale}/`) ||
          path.basename(f, path.extname(f)) === sourceLocale,
      );
      const sourceStrings = sourceCatalogs.flatMap((p) =>
        adapter.extractSourceStrings(p),
      );

      // Draft description
      spinner.start("Drafting project description…");
      let description: string;
      try {
        description = await draftDescription(readme, sourceStrings, llmModel);
        writeFileSafe(
          path.join(cwd, config.context.description),
          description + "\n",
        );
        spinner.stop(`Created ${config.context.description}`);
      } catch (err) {
        p.log.warn(
          `LLM description drafting failed (${err instanceof Error ? err.message : String(err)}) — writing stubs.`,
        );
        writeContextStubs(cwd, config, targetLocales);
        p.outro("Done (stubs created)");
        return;
      }

      // Draft per-locale style guides and glossaries
      for (const locale of targetLocales) {
        spinner.start(`Drafting style guide + glossary for ${locale}…`);

        const targetCatalogs = adapter.getCatalogPathsForLocale(locale);
        const sourcePaths = adapter.getCatalogPathsForLocale(sourceLocale);
        const translatedPairs: TranslationPair[] = [];

        for (let i = 0; i < targetCatalogs.length; i++) {
          if (!fs.existsSync(targetCatalogs[i])) continue;
          const pairs = adapter.extractTranslatedPairs(
            targetCatalogs[i],
            sourcePaths[i],
          );
          translatedPairs.push(...pairs);
        }

        try {
          const styleGuide = await draftStyleGuide(
            locale,
            description,
            translatedPairs,
            llmModel,
          );
          const glossary = await draftGlossary(
            locale,
            sourceStrings,
            description,
            translatedPairs,
            styleGuide,
            llmModel,
          );

          const styleGuidePath = resolveContextPath(
            config.context.styleGuide,
            locale,
            cwd,
          );
          const glossaryPath = resolveContextPath(
            config.context.glossary,
            locale,
            cwd,
          );

          writeFileSafe(styleGuidePath, styleGuide + "\n");
          writeFileSafe(glossaryPath, JSON.stringify(glossary, null, 2) + "\n");

          spinner.stop(`Created context files for ${locale}`);
        } catch (err) {
          p.log.warn(
            `LLM drafting failed for ${locale} (${err instanceof Error ? err.message : String(err)}) — writing stubs.`,
          );
          const styleGuidePath = resolveContextPath(
            config.context.styleGuide,
            locale,
            cwd,
          );
          const glossaryPath = resolveContextPath(
            config.context.glossary,
            locale,
            cwd,
          );
          if (!fs.existsSync(styleGuidePath)) {
            writeFileSafe(
              styleGuidePath,
              [
                `# Style guide — ${locale}`,
                "",
                "## Tone and formality",
                "<!-- Formal or informal? -->",
                "",
                "## Brand voice",
                "<!-- How should the brand sound? -->",
                "",
                "## Punctuation and formatting",
                "<!-- Any locale-specific rules? -->",
              ].join("\n") + "\n",
            );
          }
          if (!fs.existsSync(glossaryPath)) {
            writeFileSafe(glossaryPath, "{}\n");
          }
          spinner.stop(`Created stub context files for ${locale}`);
        }
      }
    } else {
      writeContextStubs(cwd, config, targetLocales);
    }

    p.note(
      [
        "Review and commit the generated files:",
        `  ${CONFIG_FILE}`,
        `  i18n/description.md`,
        ...targetLocales.map((l) => `  i18n/${l}/style-guide.md`),
        ...targetLocales.map((l) => `  i18n/${l}/glossary.json`),
      ].join("\n"),
      "Next steps",
    );

    p.outro("Done — run `p6t translate` when ready");
  },
});

// ---------------------------------------------------------------------------
// Stub writer (when skipping LLM)
// ---------------------------------------------------------------------------

function writeContextStubs(
  cwd: string,
  config: Config,
  targetLocales: string[],
): void {
  const descPath = path.join(cwd, config.context.description);
  if (!fs.existsSync(descPath)) {
    writeFileSafe(
      descPath,
      [
        "# Project description",
        "",
        "Describe your project here for translators:",
        "- What does it do?",
        "- Who are the users?",
        "- What industry/domain?",
        "- Any important vocabulary notes?",
      ].join("\n") + "\n",
    );
    p.log.success(`Created ${config.context.description}`);
  }

  for (const locale of targetLocales) {
    const styleGuidePath = resolveContextPath(
      config.context.styleGuide,
      locale,
      cwd,
    );
    const glossaryPath = resolveContextPath(
      config.context.glossary,
      locale,
      cwd,
    );

    if (!fs.existsSync(styleGuidePath)) {
      writeFileSafe(
        styleGuidePath,
        [
          `# Style guide — ${locale}`,
          "",
          "## Tone and formality",
          "<!-- Formal or informal? -->",
          "",
          "## Brand voice",
          "<!-- How should the brand sound? -->",
          "",
          "## Punctuation and formatting",
          "<!-- Any locale-specific rules? -->",
        ].join("\n") + "\n",
      );
    }

    if (!fs.existsSync(glossaryPath)) {
      writeFileSafe(glossaryPath, "{}\n");
    }

    p.log.success(`Created context files for ${locale}`);
  }
}
