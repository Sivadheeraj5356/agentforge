import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { manifestFromInspection } from "@agentforge/validation";
import { createStoredZip, inspectZip } from "@agentforge/validation";

import { normalizeRequestedPath, resolveManifestEntry } from "@/modules/tasks/server/file-content";

const MODULE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC_ROOT = path.resolve(MODULE_ROOT, "../..");

function sourceFiles(directory: string): readonly string[] {
  const collected: string[] = [];
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      collected.push(...sourceFiles(absolute));
      continue;
    }
    if (/\.(ts|tsx)$/.test(absolute) && !absolute.endsWith(".test.ts")) {
      collected.push(absolute);
    }
  }
  return collected;
}

const encoder = new TextEncoder();
const MANIFEST = manifestFromInspection(
  inspectZip(
    createStoredZip([
      { path: "instruction.md", data: encoder.encode("do the thing\n") },
      { path: "task.toml", data: encoder.encode("name = 'x'\n") },
      { path: "environment/Dockerfile", data: encoder.encode("FROM scratch\n") },
    ]),
  ),
);

describe("requested file paths", () => {
  it("accepts a path that is in the run's manifest", () => {
    const resolved = resolveManifestEntry(MANIFEST, "environment/Dockerfile");
    expect(resolved.ok).toBe(true);
  });

  it("normalizes harmless noise rather than rejecting it", () => {
    expect(normalizeRequestedPath("./task.toml")).toBe("task.toml");
    expect(normalizeRequestedPath("environment//Dockerfile")).toBe("environment/Dockerfile");
    expect(normalizeRequestedPath("environment\\Dockerfile")).toBe("environment/Dockerfile");
  });

  it("refuses traversal, absolute, drive, UNC, and NUL paths", () => {
    const hostile = [
      "../secrets.env",
      "environment/../../etc/passwd",
      "/etc/passwd",
      "C:\\Windows\\win.ini",
      "c:/windows/win.ini",
      "\\\\server\\share\\file",
      "task.toml\u0000.png",
      "..",
      "",
      "   ".replaceAll(" ", "\u0000"),
    ];

    for (const candidate of hostile) {
      expect(normalizeRequestedPath(candidate), candidate).toBeNull();
      expect(resolveManifestEntry(MANIFEST, candidate), candidate).toEqual({
        ok: false,
        error: "invalid-path",
      });
    }
  });

  it("refuses a well-formed path that is not in this run's manifest", () => {
    expect(resolveManifestEntry(MANIFEST, "solution/solve.sh")).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(resolveManifestEntry([], "task.toml")).toEqual({ ok: false, error: "not-found" });
  });

  it("refuses a storage key even though it looks like a relative path", () => {
    expect(
      resolveManifestEntry(MANIFEST, "orgs/00000000-0000-0000-0000-000000000000/ingest/x/y.zip"),
    ).toEqual({ ok: false, error: "not-found" });
  });

  it("is not fooled by a path that only differs in case", () => {
    expect(resolveManifestEntry(MANIFEST, "Environment/dockerfile")).toEqual({
      ok: false,
      error: "not-found",
    });
  });
});

describe("task inspector source constraints", () => {
  const files = sourceFiles(MODULE_ROOT);

  it("scans a non-trivial set of source files", () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it("never renders package content as markup", () => {
    // Usage forms only: JSX requires `=`, and the DOM sinks require an assignment
    // or a call. Prose that names the hazard is not the hazard.
    const offenders = files.filter((file) =>
      /dangerouslySetInnerHTML\s*=|\.(inner|outer)HTML\s*=|document\.write\s*\(/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders.map((file) => path.relative(MODULE_ROOT, file))).toEqual([]);
  });

  it("never reloads the page to recover from a state change", () => {
    const offenders = files.filter((file) =>
      /window\.location\.reload|location\.href\s*=/.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => path.relative(MODULE_ROOT, file))).toEqual([]);
  });

  it("keeps storage credentials and the service role out of the module", () => {
    const offenders = files.filter((file) =>
      /SERVICE_ROLE|service_role|SECRET_KEY|ACCESS_KEY|getSignedUrl/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders.map((file) => path.relative(MODULE_ROOT, file))).toEqual([]);
  });

  it("keeps server-only reads out of client components", () => {
    const clientFiles = files.filter((file) =>
      readFileSync(file, "utf8").startsWith('"use client"'),
    );
    expect(clientFiles.length).toBeGreaterThan(3);

    const offenders = clientFiles.filter((file) =>
      /createSupabaseServerClient|artifact-store|process\.env|node:fs/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders.map((file) => path.relative(MODULE_ROOT, file))).toEqual([]);
  });

  it("keeps the server-only validation entry point out of the browser bundle", () => {
    const clientFiles = files.filter((file) =>
      readFileSync(file, "utf8").startsWith('"use client"'),
    );
    const offenders = clientFiles.filter((file) =>
      /from "@(?:vortex|agentforge)\/validation"/.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => path.relative(MODULE_ROOT, file))).toEqual([]);
  });

  it("exposes exactly one route that returns file content", () => {
    const routes = sourceFiles(path.join(WEB_SRC_ROOT, "app")).filter((file) =>
      file.endsWith(`${path.sep}route.ts`),
    );
    const fileRoutes = routes.filter((file) => /readTaskFile/.test(readFileSync(file, "utf8")));
    expect(fileRoutes.map((file) => path.relative(WEB_SRC_ROOT, file))).toHaveLength(1);
  });
});

describe("authenticated file cache isolation", () => {
  it("never marks task bytes immutable or cacheable across account switches", () => {
    const route = readFileSync(
      path.join(
        WEB_SRC_ROOT,
        "app/app/[organizationSlug]/projects/[projectSlug]/tasks/[taskSlug]/runs/[runId]/file/route.ts",
      ),
      "utf8",
    );
    expect(route).toContain('200, "private, no-store"');
    expect(route).not.toContain("max-age=");
    const inspector = readFileSync(path.join(MODULE_ROOT, "components/task-inspector.tsx"), "utf8");
    expect(inspector).toContain('cache: "no-store"');
    expect(inspector).toContain("?cacheVersion=2&path=");
  });
});
