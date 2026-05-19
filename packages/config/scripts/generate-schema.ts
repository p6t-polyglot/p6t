import * as fs from "node:fs";
import * as path from "node:path";
import * as z from "zod";
import { ConfigSchema } from "../src/config";

function addAdditionalPropertiesFalse<T>(schema: T): T {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(addAdditionalPropertiesFalse) as T;
  }

  const obj = schema as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    result[key] = addAdditionalPropertiesFalse(value);
  }

  // Add additionalProperties: false to any object that has properties
  if (obj.type === "object" && "properties" in obj) {
    result.additionalProperties = false;
  }

  return result as T;
}

const rawSchema = z.toJSONSchema(ConfigSchema, {
  io: "input",
  target: "draft-2020-12",
});

const schema = addAdditionalPropertiesFalse(rawSchema);

// Inject metadata that z.toJSONSchema doesn't know about
const enriched = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://p6t.dev/schema/i18n.json",
  title: "p6t i18n configuration",
  description: "Configuration file for the p6t translation pipeline CLI.",
  ...schema,
};

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const outPath = path.resolve(
  scriptDir,
  "../../../apps/docs/public/schema/i18n.json",
);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(enriched, null, 2) + "\n");

console.log("Generated", outPath);
