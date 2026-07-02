import fs from "node:fs";
import { parseEnv } from "node:util";

// Side-effect module: load .env files before any other import is evaluated.
// Bun auto-loaded these; Node does not. Imported first in index.ts so this
// runs before modules that read process.env are evaluated.
//
// Precedence matches Bun: shell environment wins, then .env.local over .env.
// `process.loadEnvFile` would clobber existing keys, so we parse ourselves and
// only fill in keys the shell hasn't already set.

const shellKeys = new Set(Object.keys(process.env));

for (const file of [".env", ".env.local"]) {
  let contents: string;
  try {
    contents = fs.readFileSync(file, "utf8");
  } catch {
    continue; // file absent — skip
  }
  for (const [key, value] of Object.entries(parseEnv(contents))) {
    if (!shellKeys.has(key)) process.env[key] = value;
  }
}
