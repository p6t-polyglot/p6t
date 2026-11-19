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
    "<!-- Name the users, their jobs, and product concepts that change the meaning of UI copy. -->",
    "",
  ].join("\n"));
  for (const locale of config.locale.targets) {
    create(config.context.styleGuide, locale, styleGuideStub(locale));
    create(config.context.glossary, locale, "{}\n");
  }
  return created;
}

export function styleGuideStub(locale: string) {
  return [
    `# Style guide — ${locale}`,
    "",
    "<!-- Record only choices that change the translation. For each, write when it applies, what to use, and an example. -->",
    "",
  ].join("\n");
}
