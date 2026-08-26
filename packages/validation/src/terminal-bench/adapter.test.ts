import type { WorkspaceEntry } from "@agentforge/contracts";
import { describe, expect, it } from "vitest";

import { createWorkspaceReader } from "../workspace/reader";
import type { WorkspaceSnapshot } from "../workspace/snapshot";
import { TerminalBenchAdapter } from "./adapter";
import { TerminusAdapter } from "../terminus/adapter";
import { createDefaultBenchmarkAdapterRegistry } from "../registry";

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

const TERMINUS_MIN = {
  "instruction.md": "Fix the bug.",
  "task.toml": "[metadata]\nname = 'demo'\n",
  "environment/Dockerfile": "FROM python:3.12-slim\nWORKDIR /workspace\n",
  "tests/test.sh": "#!/bin/bash\npytest\n",
};

const TB2_MIN = {
  ...TERMINUS_MIN,
  "run-tests.sh": "#!/bin/bash\npytest tests\n",
  "tests/test_outputs.py": "def test_ok():\n    assert True\n",
};

describe("TerminalBenchAdapter", () => {
  it("matches a Terminal Bench 2 layout with higher confidence than Terminus", () => {
    const workspace = createWorkspaceReader(snapshotFromFiles(TB2_MIN));
    const tb = new TerminalBenchAdapter().detect(workspace);
    const terminus = new TerminusAdapter().detect(workspace);
    expect(tb.matched).toBe(true);
    expect(tb.adapterId).toBe("terminal-bench");
    expect(tb.confidence).toBeGreaterThanOrEqual(terminus.confidence);
  });

  it("does not match an empty workspace", () => {
    const workspace = createWorkspaceReader(snapshotFromFiles({}));
    expect(new TerminalBenchAdapter().detect(workspace).matched).toBe(false);
  });

  it("wins registry detection on TB2 markers", () => {
    const workspace = createWorkspaceReader(snapshotFromFiles(TB2_MIN));
    const match = createDefaultBenchmarkAdapterRegistry().detect(workspace);
    expect(match?.adapter.id).toBe("terminal-bench");
  });
});
