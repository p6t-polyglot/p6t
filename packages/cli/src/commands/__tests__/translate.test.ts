import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommand } from "citty";
import * as p from "@clack/prompts";
import { translateCommand } from "../translate.ts";
import { getConfigDir, loadConfig } from "../../config/loader.ts";
import { DefaultTranslator } from "../../llm/translator.ts";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
}));
vi.mock("../../config/loader.ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../config/loader.ts")>(),
  loadConfig: vi.fn(),
  getConfigDir: vi.fn(),
}));
vi.mock("../../llm/providers.ts", () => ({ createModel: vi.fn() }));
vi.mock("../../llm/translator.ts", () => ({
  DefaultTranslator: vi.fn(class {
    translate = vi.fn();
  }),
}));

describe("translate output", () => {
  let dir: string;
  let stdout: string;
  let stderr: string;
  let translate: ReturnType<typeof vi.fn>;
  const originalExitCode = process.exitCode;
  const originalTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

  beforeEach(() => {
    vi.clearAllMocks();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "p6t-translate-"));
    stdout = "";
    stderr = "";
    process.exitCode = 0;
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr += String(chunk);
      return true;
    });
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, get: () => false });
    vi.mocked(loadConfig).mockReturnValue({
      version: 1,
      format: "react-intl",
      locale: { source: "en", targets: ["de"] },
      catalogs: [{ path: "{locale}.json" }],
      provider: { id: "google", model: "test-model" },
      context: {
        description: "description.md",
        styleGuide: "{locale}/style-guide.md",
        glossary: "{locale}/glossary.json",
      },
    });
    vi.mocked(getConfigDir).mockReturnValue(dir);
    fs.writeFileSync(path.join(dir, "en.json"), JSON.stringify({
      open: { defaultMessage: "Open", description: "Project action", file: "src/main.ts", line: 1 },
      save: { defaultMessage: "Save", description: "Project action", file: "src/main.ts", line: 2 },
    }));
    fs.writeFileSync(path.join(dir, "de.json"), JSON.stringify({
      stale: { defaultMessage: "Alt" },
    }));
    translate = vi.fn().mockResolvedValue({
      results: [{ id: "open", translation: "Öffnen" }, { id: "save", translation: "Speichern" }],
      missing: [],
      rawResponse: undefined,
    });
    vi.mocked(DefaultTranslator).mockImplementation(class {
      translate = translate;
    } as unknown as typeof DefaultTranslator);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalTTY) Object.defineProperty(process.stdout, "isTTY", originalTTY);
    else Reflect.deleteProperty(process.stdout, "isTTY");
    process.exitCode = originalExitCode;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function run(...rawArgs: string[]) {
    await runCommand(translateCommand, { rawArgs });
  }

  it("prints one JSON object with per-file counts and no progress or human logs", async () => {
    await run("--json");
    expect(JSON.parse(stdout)).toEqual({
      files: [{
        locale: "de",
        sourcePath: path.join(dir, "en.json"),
        targetPath: path.join(dir, "de.json"),
        pending: 2,
        translated: 2,
        missing: 0,
        failed: 0,
        removed: 1,
        errors: [],
      }],
      errors: [],
    });
    expect(stdout.trim().split("\n")).toHaveLength(1);
    expect(p.spinner).not.toHaveBeenCalled();
    expect(p.intro).not.toHaveBeenCalled();
    expect(p.log.info).not.toHaveBeenCalled();
    expect(p.outro).not.toHaveBeenCalled();
    expect(stderr).toBe("");
    expect(process.exitCode).toBe(0);
  });

  it.each([{ args: [] }, { args: ["--no-progress"] }, { args: ["--quiet"] }])("uses bounded plain output for $args", async ({ args }) => {
    await run(...args);
    expect(p.spinner).not.toHaveBeenCalled();
    expect(stdout).toContain("de.json: translated 2/2, missing 0, failed 0, removed 1");
    expect(stdout).not.toMatch(/[\r\u001b]/);
  });

  it.each([{ args: ["--quiet"] }, { args: ["--no-progress"] }, { args: ["--json"] }])("disables TTY progress for $args", async ({ args }) => {
    vi.spyOn(process.stdout, "isTTY", "get").mockReturnValue(true);
    await run(...args);
    expect(p.spinner).not.toHaveBeenCalled();
  });

  it("keeps interactive progress in a TTY by default", async () => {
    vi.spyOn(process.stdout, "isTTY", "get").mockReturnValue(true);
    await run();
    expect(p.spinner).toHaveBeenCalledOnce();
  });

  it("reports already-translated files with zero counts", async () => {
    await run("--json");
    stdout = "";
    translate.mockClear();
    await run("--json");
    expect(JSON.parse(stdout).files[0]).toMatchObject({
      pending: 0, translated: 0, missing: 0, failed: 0, removed: 0,
    });
    expect(translate).not.toHaveBeenCalled();
  });

  it("reports omitted results and exits nonzero even with --verbose --json", async () => {
    translate.mockResolvedValue({
      results: [{ id: "open", translation: "Öffnen" }],
      missing: [{ id: "save", source: "Save" }],
      rawResponse: "sensitive raw response",
    });
    await run("--json", "--verbose");
    expect(JSON.parse(stdout).files[0]).toMatchObject({ translated: 1, missing: 1, failed: 0 });
    expect(stdout).not.toContain("sensitive raw response");
    expect(process.exitCode).toBe(1);
  });

  it("counts failed strings and includes errors without corrupting JSON", async () => {
    translate.mockRejectedValue(new Error("Provider unavailable"));
    await run("--json");
    expect(JSON.parse(stdout).files[0]).toMatchObject({
      translated: 0, missing: 0, failed: 2, errors: ["Provider unavailable"],
    });
    expect(process.exitCode).toBe(1);
  });

  it("reports setup errors as JSON too", async () => {
    vi.mocked(loadConfig).mockImplementation(() => { throw new Error("No i18n.json found"); });
    await run("--json");
    expect(JSON.parse(stdout)).toEqual({ files: [], errors: ["No i18n.json found"] });
    expect(process.exitCode).toBe(1);
  });

  it("reports invalid --max-orphans without starting translation", async () => {
    await run("--json", "--max-orphans", "bad");
    expect(JSON.parse(stdout).errors).toEqual(["Invalid --max-orphans value. Must be a non-negative integer."]);
    expect(translate).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
