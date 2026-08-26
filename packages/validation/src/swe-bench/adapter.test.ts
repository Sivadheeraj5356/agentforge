import type { WorkspaceEntry } from "@agentforge/contracts";
import { describe, expect, it } from "vitest";

import { createWorkspaceReader } from "../workspace/reader";
import type { WorkspaceSnapshot } from "../workspace/snapshot";
import { SweBenchAdapter } from "./adapter";

function snapshotFromFiles(files: Record<string, string>): WorkspaceSnapshot {
  const text = new Map<string, string>();
  const entries: WorkspaceEntry[] = [];
  const directories = new Set<string>();

  for (const [relativePath, body] of Object.entries(files)) {
    const parts = relativePath.split("/");
    for (let i = 0; i < parts.length - 1; i += 1) {
      directories.add(parts.slice(0, i + 1).join("/"));
    }
    text.set(relativePath, body);
    entries.push({ relativePath, kind: "file", byteSize: Buffer.byteLength(body) });
  }
  for (const directory of directories) {
    entries.push({ relativePath: directory, kind: "directory", byteSize: 0 });
  }

  return {
    entries,
    files: Object.keys(files).sort(),
    directories: [...directories].sort(),
    text,
  };
}

describe("SweBenchAdapter", () => {
  it("does not match a Terminus package", () => {
    const workspace = createWorkspaceReader(
      snapshotFromFiles({
        "instruction.md": "fix the api",
        "task.toml": 'version = "1.0.0"',
      }),
    );
    expect(new SweBenchAdapter().detect(workspace).matched).toBe(false);
  });

  it("matches and refuses a SWE-bench instance file", () => {
    const workspace = createWorkspaceReader(
      snapshotFromFiles({
        "instance.json": JSON.stringify({
          instance_id: "django__django-123",
          FAIL_TO_PASS: ["tests.test_foo"],
        }),
      }),
    );
    const adapter = new SweBenchAdapter();
    expect(adapter.detect(workspace).matched).toBe(true);
    expect(() =>
      adapter.parseTask(workspace, { rootPath: "", externalKey: "swe-bench-unsupported" }),
    ).toThrow(/refuses/);
  });
});
