import { describe, expect, it } from "vitest";

import { MAX_WORKSPACE_PATH_LENGTH } from "../limits";
import { isWithinDirectory, joinWorkspacePath, normalizeWorkspacePath } from "./paths";
import { WorkspacePathError } from "./paths";

describe("normalizeWorkspacePath", () => {
  it("keeps ordinary relative paths", () => {
    expect(normalizeWorkspacePath("tests/test.sh")).toBe("tests/test.sh");
    expect(normalizeWorkspacePath("./environment/Dockerfile")).toBe("environment/Dockerfile");
    expect(normalizeWorkspacePath("tasks//alpha/task.toml")).toBe("tasks/alpha/task.toml");
  });

  it("treats an empty path as the workspace root", () => {
    expect(normalizeWorkspacePath("")).toBe("");
    expect(normalizeWorkspacePath(".")).toBe("");
  });

  it("rejects parent traversal anywhere in the path", () => {
    expect(() => normalizeWorkspacePath("../secrets.txt")).toThrow(WorkspacePathError);
    expect(() => normalizeWorkspacePath("tests/../../secrets.txt")).toThrow(WorkspacePathError);
    expect(() => normalizeWorkspacePath("tests\\..\\..\\secrets.txt")).toThrow(WorkspacePathError);
  });

  it("rejects absolute paths and Windows drive letters", () => {
    expect(() => normalizeWorkspacePath("/etc/passwd")).toThrow(/absolute/);
    expect(() => normalizeWorkspacePath("C:/Windows/System32")).toThrow(/absolute/);
    expect(() => normalizeWorkspacePath("\\\\server\\share")).toThrow(/absolute/);
  });

  it("rejects NUL bytes and oversized paths", () => {
    expect(() => normalizeWorkspacePath("tests/te\0st.sh")).toThrow(/NUL/);
    expect(() => normalizeWorkspacePath("a".repeat(MAX_WORKSPACE_PATH_LENGTH + 1))).toThrow(
      /too long/,
    );
  });
});

describe("joinWorkspacePath", () => {
  it("drops empty parts so a root-level task works", () => {
    expect(joinWorkspacePath("", "task.toml")).toBe("task.toml");
    expect(joinWorkspacePath("tasks/alpha", "task.toml")).toBe("tasks/alpha/task.toml");
  });
});

describe("isWithinDirectory", () => {
  it("matches the directory itself and its descendants only", () => {
    expect(isWithinDirectory("tests/test.sh", "tests")).toBe(true);
    expect(isWithinDirectory("tests", "tests")).toBe(true);
    expect(isWithinDirectory("tests-extra/test.sh", "tests")).toBe(false);
    expect(isWithinDirectory("anything", "")).toBe(true);
  });
});
