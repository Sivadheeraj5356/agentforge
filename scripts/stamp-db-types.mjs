import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve("packages/contracts/src/database.generated.ts");
const body = readFileSync(target, "utf8");
const banner = `/**
 * Generated Database types for Supabase.
 *
 * Regenerate with: \`pnpm db:types\`
 * Do not hand-edit this file.
 */

`;

if (!body.includes("Generated Database types")) {
  writeFileSync(target, banner + body, "utf8");
}
