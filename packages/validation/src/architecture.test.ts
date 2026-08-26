import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Structural guardrails for the permanent constraints. Wording in docs drifts;
 * these assertions do not.
 */
const FORBIDDEN_IN_SOURCE: readonly { readonly pattern: RegExp; readonly reason: string }[] = [
  { pattern: /node:child_process/, reason: "spawning processes" },
  { pattern: /\bexecSync\b|\bspawnSync\b|\bexecFile\b/, reason: "executing commands" },
  { pattern: /node:http\b|node:https\b|node:net\b|node:dgram\b/, reason: "network access" },
  { pattern: /\bfetch\s*\(/, reason: "network access" },
  { pattern: /node:vm\b|\bnew Function\s*\(|\beval\s*\(/, reason: "evaluating uploaded content" },
  { pattern: /openai|anthropic|ModelProvider/i, reason: "model providers" },
];

/** The pipeline and validators must not reach for a reviewer or analysis provider. */
const PROVIDER_FREE_DIRECTORIES = ["pipeline", "validators", "terminus", "findings", "policy"];

function sourceFiles(directory: string): readonly string[] {
  const collected: string[] = [];
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      collected.push(...sourceFiles(absolute));
      continue;
    }
    if (absolute.endsWith(".ts") && !absolute.endsWith(".test.ts")) {
      collected.push(absolute);
    }
  }
  return collected;
}

describe("validation package never executes user code and never calls a model", () => {
  const files = sourceFiles(SOURCE_ROOT);

  it("scans a non-trivial set of source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const { pattern, reason } of FORBIDDEN_IN_SOURCE) {
    it(`contains no reference to ${reason}`, () => {
      const offenders = files.filter((file) => pattern.test(readFileSync(file, "utf8")));
      expect(offenders.map((file) => path.relative(SOURCE_ROOT, file))).toEqual([]);
    });
  }

  it("keeps ReviewProvider and AnalysisProvider out of the deterministic path", () => {
    const offenders = files
      .filter((file) =>
        PROVIDER_FREE_DIRECTORIES.includes(
          path.relative(SOURCE_ROOT, file).split(path.sep)[0] ?? "",
        ),
      )
      .filter((file) =>
        /ReviewProvider|AnalysisProvider|providers\//.test(readFileSync(file, "utf8")),
      );
    expect(offenders.map((file) => path.relative(SOURCE_ROOT, file))).toEqual([]);
  });

  it("keeps database, auth, and session objects out of the package", () => {
    const offenders = files.filter((file) =>
      /supabase|createClient|getSession|serviceRole|SUPABASE_/i.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => path.relative(SOURCE_ROOT, file))).toEqual([]);
  });

  it("keeps React out of the pipeline so a worker or CLI can call it", () => {
    const offenders = files.filter((file) => /from "react|jsx/.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(SOURCE_ROOT, file))).toEqual([]);
  });
});

/**
 * `src/browser.ts` is what client components import. If anything it reaches pulls
 * in a Node built-in, the browser build breaks — so the boundary is asserted here
 * rather than discovered during `next build`.
 */
describe("the browser entry point stays free of Node built-ins", () => {
  function resolveLocalImport(fromFile: string, specifier: string): string | null {
    if (!specifier.startsWith(".")) {
      return null;
    }
    const base = path.resolve(path.dirname(fromFile), specifier);
    for (const candidate of [`${base}.ts`, path.join(base, "index.ts")]) {
      try {
        if (statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  function reachableFrom(entry: string): readonly string[] {
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const current = queue.pop();
      if (!current || seen.has(current)) {
        continue;
      }
      seen.add(current);
      const source = readFileSync(current, "utf8");
      for (const match of source.matchAll(/from "([^"]+)"/g)) {
        const resolved = resolveLocalImport(current, match[1] ?? "");
        if (resolved) {
          queue.push(resolved);
        }
      }
    }
    return [...seen];
  }

  const reachable = reachableFrom(path.join(SOURCE_ROOT, "browser.ts"));

  it("reaches a real module graph", () => {
    expect(reachable.length).toBeGreaterThan(3);
  });

  it("imports no node: built-in, directly or transitively", () => {
    const offenders = reachable.filter((file) => /from "node:/.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(SOURCE_ROOT, file))).toEqual([]);
  });

  it("does not reach the pipeline, the archive reader, or the filesystem workspace", () => {
    const forbidden = reachable.filter((file) =>
      ["pipeline", "archive"].includes(path.relative(SOURCE_ROOT, file).split(path.sep)[0] ?? ""),
    );
    expect(forbidden.map((file) => path.relative(SOURCE_ROOT, file))).toEqual([]);
  });
});
