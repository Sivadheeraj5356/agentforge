import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const target = resolve(root, "packages/contracts/src/database.generated.ts");

function resolveSupabaseBin() {
  const binDir = resolve(root, "node_modules", ".bin");
  if (process.platform === "win32") {
    const cmd = resolve(binDir, "supabase.CMD");
    const ps1 = resolve(binDir, "supabase.ps1");
    const exe = resolve(binDir, "supabase.exe");
    if (existsSync(cmd)) return { file: cmd, viaShell: true };
    if (existsSync(exe)) return { file: exe, viaShell: false };
    if (existsSync(ps1)) return { file: ps1, viaShell: true };
  }
  const posix = resolve(binDir, "supabase");
  if (existsSync(posix)) return { file: posix, viaShell: false };
  return { file: "supabase", viaShell: process.platform === "win32" };
}

const { file: supabaseBin, viaShell } = resolveSupabaseBin();

let generated;
try {
  generated = execFileSync(supabaseBin, ["gen", "types", "typescript", "--local"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: viaShell,
    windowsHide: true,
    env: process.env,
  });
} catch (error) {
  const err = error;
  console.error(err.stderr?.toString?.() ?? err.message ?? err);
  console.error(`Tried binary: ${supabaseBin} (shell=${viaShell})`);
  process.exit(1);
}

const banner = `/**
 * Generated Database types for Supabase.
 *
 * Regenerate with: \`pnpm db:types\`
 * Do not hand-edit this file.
 */

`;

writeFileSync(target, banner + generated, "utf8");

const prettierBin = resolve(root, "node_modules", "prettier", "bin", "prettier.cjs");
if (existsSync(prettierBin)) {
  execFileSync(process.execPath, [prettierBin, "--write", target], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
}

console.log(`Wrote ${target}`);
