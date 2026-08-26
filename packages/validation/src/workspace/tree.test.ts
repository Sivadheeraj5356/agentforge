import { describe, expect, it } from "vitest";

import { ancestorDirectories, buildFileTree, visibleTreeNodes } from "./tree";
import { WorkspacePathError } from "./paths";

const MANIFEST = [
  { path: "tests/test.sh", byteSize: 120 },
  { path: "instruction.md", byteSize: 400 },
  { path: "environment/Dockerfile", byteSize: 220 },
  { path: "environment/config/app.toml", byteSize: 64 },
  { path: "task.toml", byteSize: 180 },
];

describe("buildFileTree", () => {
  it("nests directories and puts directories before files at every level", () => {
    const tree = buildFileTree(MANIFEST);

    expect(tree.map((node) => `${node.kind}:${node.name}`)).toEqual([
      "directory:environment",
      "directory:tests",
      "file:instruction.md",
      "file:task.toml",
    ]);

    const environment = tree[0];
    expect(environment?.kind).toBe("directory");
    if (environment?.kind !== "directory") {
      throw new Error("expected a directory");
    }
    expect(environment.children.map((node) => `${node.kind}:${node.name}`)).toEqual([
      "directory:config",
      "file:Dockerfile",
    ]);
    expect(environment.fileCount).toBe(2);
    expect(environment.children[0]?.depth).toBe(1);
  });

  it("keeps full paths as node ids and preserves byte sizes", () => {
    const tree = buildFileTree(MANIFEST);
    const environment = tree[0];
    if (environment?.kind !== "directory") {
      throw new Error("expected a directory");
    }
    const dockerfile = environment.children[1];

    expect(dockerfile?.path).toBe("environment/Dockerfile");
    expect(dockerfile?.kind === "file" ? dockerfile.byteSize : null).toBe(220);
  });

  it("is stable regardless of manifest order", () => {
    const forward = buildFileTree(MANIFEST);
    const reversed = buildFileTree([...MANIFEST].reverse());

    expect(JSON.stringify(reversed)).toEqual(JSON.stringify(forward));
  });

  it("refuses a manifest entry that would escape the workspace", () => {
    expect(() => buildFileTree([{ path: "../secrets.env", byteSize: 1 }])).toThrow(
      WorkspacePathError,
    );
    expect(() => buildFileTree([{ path: "/etc/passwd", byteSize: 1 }])).toThrow(WorkspacePathError);
  });

  it("handles an empty manifest", () => {
    expect(buildFileTree([])).toEqual([]);
  });
});

describe("visibleTreeNodes", () => {
  it("shows children only for expanded directories", () => {
    const tree = buildFileTree(MANIFEST);

    expect(visibleTreeNodes(tree, new Set()).map((node) => node.path)).toEqual([
      "environment",
      "tests",
      "instruction.md",
      "task.toml",
    ]);

    expect(visibleTreeNodes(tree, new Set(["environment"])).map((node) => node.path)).toEqual([
      "environment",
      "environment/config",
      "environment/Dockerfile",
      "tests",
      "instruction.md",
      "task.toml",
    ]);
  });
});

describe("ancestorDirectories", () => {
  it("lists every directory on the way to a file, outermost first", () => {
    expect(ancestorDirectories("environment/config/app.toml")).toEqual([
      "environment",
      "environment/config",
    ]);
    expect(ancestorDirectories("task.toml")).toEqual([]);
  });
});
