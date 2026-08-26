import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createMemoryWorkspace } from "./memory";
import { WorkspacePathError } from "./paths";
import { createWorkspaceReader, WorkspaceReadError } from "./reader";
import { loadWorkspaceSnapshot } from "./snapshot";

const FILES = [
  { path: "instruction.md", content: "Do the thing." },
  { path: "task.toml", content: 'version = "1.0.0"\n' },
  { path: "environment/Dockerfile", content: "FROM ubuntu:24.04\n" },
  { path: "environment/package.json", content: '{ "dependencies": { "left-pad": "1.3.0" } }' },
  { path: "tests/test.sh", content: "true\n" },
];

describe("WorkspaceReader", () => {
  const workspace = createMemoryWorkspace(FILES);

  it("reports existence for files, directories, and the root", () => {
    expect(workspace.exists("task.toml")).toBe(true);
    expect(workspace.exists("environment")).toBe(true);
    expect(workspace.exists("")).toBe(true);
    expect(workspace.exists("missing.txt")).toBe(false);
  });

  it("stats files and directories", () => {
    expect(workspace.stat("tests/test.sh")).toEqual({
      relativePath: "tests/test.sh",
      kind: "file",
      byteSize: 5,
    });
    expect(workspace.stat("tests")?.kind).toBe("directory");
    expect(workspace.stat("nope")).toBeNull();
  });

  it("reads text and normalizes separators", () => {
    expect(workspace.readText("environment/Dockerfile")).toContain("FROM ubuntu:24.04");
    expect(workspace.readText("environment\\Dockerfile")).toContain("FROM ubuntu:24.04");
    expect(workspace.readText("missing.md")).toBeNull();
  });

  it("reads JSON, returns null when absent, and throws on malformed JSON", () => {
    expect(workspace.readJson("environment/package.json")).toEqual({
      dependencies: { "left-pad": "1.3.0" },
    });
    expect(workspace.readJson("environment/absent.json")).toBeNull();

    const broken = createMemoryWorkspace([{ path: "broken.json", content: "{ not json" }]);
    expect(() => broken.readJson("broken.json")).toThrow(WorkspaceReadError);
  });

  it("lists files recursively and directories as immediate children", () => {
    expect(workspace.listFiles()).toEqual([
      "environment/Dockerfile",
      "environment/package.json",
      "instruction.md",
      "task.toml",
      "tests/test.sh",
    ]);
    expect(workspace.listFiles("environment")).toEqual([
      "environment/Dockerfile",
      "environment/package.json",
    ]);
    expect(workspace.listDirectories()).toEqual(["environment", "tests"]);
    expect(workspace.listDirectories("environment")).toEqual([]);
  });

  it("confines every entry point to the workspace", () => {
    expect(() => workspace.resolveSafePath("../outside")).toThrow(WorkspacePathError);
    expect(() => workspace.exists("../outside")).toThrow(WorkspacePathError);
    expect(() => workspace.readText("/etc/passwd")).toThrow(WorkspacePathError);
    expect(() => workspace.listFiles("../..")).toThrow(WorkspacePathError);
    // Traversal is refused, not resolved, even when it would land inside the workspace.
    expect(() => workspace.resolveSafePath("./tests/../tests/test.sh")).toThrow(WorkspacePathError);
    expect(workspace.resolveSafePath("./tests/test.sh")).toBe("tests/test.sh");
  });
});

describe("loadWorkspaceSnapshot", () => {
  it("skips symbolic links so they can never be followed out of the workspace", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "agentforge-reader-test-"));
    try {
      await mkdir(path.join(directory, "environment"), { recursive: true });
      await writeFile(path.join(directory, "instruction.md"), "Do the thing.");
      try {
        await symlink(tmpdir(), path.join(directory, "escape"), "dir");
      } catch {
        return; // Unprivileged Windows sessions cannot create symlinks.
      }

      const workspace = createWorkspaceReader(await loadWorkspaceSnapshot(directory));
      expect(workspace.exists("instruction.md")).toBe(true);
      expect(workspace.exists("escape")).toBe(false);
      expect(workspace.listFiles()).toEqual(["instruction.md"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
