import { describe, expect, it } from "vitest";

import type { InspectorFinding } from "@/modules/tasks/model";
import {
  createInspectorState,
  fileLevelFindings,
  findingLinesForFile,
  findingsAtLocation,
  inspectorReducer,
  type InspectorState,
} from "@/modules/tasks/navigation";

function finding(
  id: string,
  path: string | null,
  line: number | null,
  code = `CODE_${id.toUpperCase()}`,
): InspectorFinding {
  return {
    id,
    ordinal: 0,
    fingerprint: `fp-${id}`,
    code,
    category: "environment",
    severity: "warning",
    status: "open",
    title: `Finding ${id}`,
    message: "",
    remediation: null,
    validatorId: "environment",
    validatorName: "Environment",
    validatorVersion: "1.0.0",
    evidence: { path, line, fieldPath: null, excerpt: null },
  };
}

const EMPTY: InspectorState = createInspectorState({
  path: null,
  line: null,
  findingId: null,
  expanded: [],
});

describe("createInspectorState", () => {
  it("restores a shared link, marking the line as something to reveal", () => {
    const state = createInspectorState({
      path: "environment/Dockerfile",
      line: 12,
      findingId: null,
      expanded: ["environment"],
    });

    expect(state.selection).toEqual({
      path: "environment/Dockerfile",
      line: 12,
      origin: "url",
    });
    expect(state.expanded.has("environment")).toBe(true);
    expect(state.revealToken).toBe(1);
  });

  it("starts with nothing selected when the link carries no file", () => {
    expect(EMPTY.selection).toBeNull();
    expect(EMPTY.revealToken).toBe(0);
  });
});

describe("inspectorReducer", () => {
  it("selects a file from the tree and drops the active finding", () => {
    const withFinding = inspectorReducer(EMPTY, {
      type: "open-finding",
      findingId: "a",
      path: "task.toml",
      line: 3,
      ancestors: [],
    });
    const selected = inspectorReducer(withFinding, {
      type: "select-file",
      path: "instruction.md",
    });

    expect(selected.selection).toEqual({ path: "instruction.md", line: null, origin: "tree" });
    expect(selected.activeFindingId).toBeNull();
  });

  it("opens a finding: reveals the file, the line, and the directories above it", () => {
    const state = inspectorReducer(EMPTY, {
      type: "open-finding",
      findingId: "b",
      path: "environment/config/app.toml",
      line: 9,
      ancestors: ["environment", "environment/config"],
    });

    expect(state.selection).toEqual({
      path: "environment/config/app.toml",
      line: 9,
      origin: "finding",
    });
    expect([...state.expanded].sort()).toEqual(["environment", "environment/config"]);
    expect(state.activeFindingId).toBe("b");
    expect(state.revealToken).toBe(EMPTY.revealToken + 1);
  });

  it("re-opening the same finding still moves the viewport", () => {
    const first = inspectorReducer(EMPTY, {
      type: "open-finding",
      findingId: "b",
      path: "task.toml",
      line: 2,
      ancestors: [],
    });
    const second = inspectorReducer(first, {
      type: "open-finding",
      findingId: "b",
      path: "task.toml",
      line: 2,
      ancestors: [],
    });

    expect(second.revealToken).toBe(first.revealToken + 1);
  });

  it("keeps a finding without a location out of the viewer", () => {
    const state = inspectorReducer(EMPTY, {
      type: "open-finding",
      findingId: "c",
      path: null,
      line: null,
      ancestors: [],
    });

    expect(state.selection).toBeNull();
    expect(state.activeFindingId).toBe("c");
  });

  it("toggles directories", () => {
    const opened = inspectorReducer(EMPTY, { type: "toggle-directory", path: "tests" });
    expect(opened.expanded.has("tests")).toBe(true);
    expect(
      inspectorReducer(opened, { type: "toggle-directory", path: "tests" }).expanded.has("tests"),
    ).toBe(false);
  });

  it("returns the same state when nothing would change", () => {
    const selected = inspectorReducer(EMPTY, { type: "select-file", path: "task.toml" });
    expect(inspectorReducer(selected, { type: "select-file", path: "task.toml" })).toBe(selected);
    expect(inspectorReducer(selected, { type: "focus-finding", findingId: null })).toBe(selected);
    expect(inspectorReducer(EMPTY, { type: "select-line", line: 4 })).toBe(EMPTY);
  });

  it("selects a line within the current file", () => {
    const selected = inspectorReducer(EMPTY, { type: "select-file", path: "task.toml" });
    const withLine = inspectorReducer(selected, { type: "select-line", line: 7 });
    expect(withLine.selection).toEqual({ path: "task.toml", line: 7, origin: "tree" });
  });
});

describe("findings anchored to a location", () => {
  const findings = [
    finding("a", "environment/Dockerfile", 4, "TASK_ENVIRONMENT_WORKDIR_MISSING"),
    finding("b", "environment/Dockerfile", 4, "TASK_ENVIRONMENT_SOLUTION_LEAK"),
    finding("c", "environment/Dockerfile", 4, "TASK_SECURITY_DOCKER_SOCKET"),
    finding("d", "environment/Dockerfile", 9),
    finding("e", "environment/Dockerfile", null),
    finding("f", "task.toml", 4),
    finding("g", null, null),
  ];

  it("returns every finding at a location, never just the last one", () => {
    expect(
      findingsAtLocation(findings, "environment/Dockerfile", 4).map((entry) => entry.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("groups a file's findings by line without collapsing duplicates", () => {
    const byLine = findingLinesForFile(findings, "environment/Dockerfile");

    expect([...byLine.keys()].sort((left, right) => left - right)).toEqual([4, 9]);
    expect(byLine.get(4)?.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(byLine.get(9)?.map((entry) => entry.id)).toEqual(["d"]);
  });

  it("separates findings about a whole file from findings on a line", () => {
    expect(fileLevelFindings(findings, "environment/Dockerfile").map((entry) => entry.id)).toEqual([
      "e",
    ]);
  });

  it("does not leak findings across files at the same line number", () => {
    expect(findingsAtLocation(findings, "task.toml", 4).map((entry) => entry.id)).toEqual(["f"]);
  });
});
