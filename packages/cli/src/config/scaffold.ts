import fs from "node:fs";
import path from "node:path";
import type { Config } from "@p6t/config";
import { resolveContextPath } from "./loader.ts";

export function writeProjectConfig(cwd: string, config: Config, createOnly = false) {
  fs.writeFileSync(
    path.join(cwd, "i18n.json"),
    JSON.stringify({ $schema: "https://p6t.dev/schema/i18n.json", ...config }, null, 2) + "\n",
    { flag: createOnly ? "wx" : "w" },
  );
}

export function writeContextStubs(cwd: string, config: Config) {
  const created: string[] = [];
  function create(template: string, locale: string, content: string) {
    const file = resolveContextPath(template, locale, cwd);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      fs.writeFileSync(file, content, { flag: "wx" });
      created.push(path.relative(cwd, file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }

  create(config.context.description, config.locale.source, [
    "# Project description",
    "",
    "Describe your project here for translators:",
    "- What does it do?",
    "- Who are the users?",
    "- What industry/domain?",
    "- Any important vocabulary notes?",
    "",
  ].join("\n"));
  for (const locale of config.locale.targets) {
    create(config.context.styleGuide, locale, [
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
      "",
    ].join("\n"));
    create(config.context.glossary, locale, "{}\n");
  }
  return created;
}
