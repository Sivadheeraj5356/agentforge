import type { InspectorFinding } from "@/modules/tasks/model";

/**
 * Typed navigation state for the inspector.
 *
 * Every jump between panes goes through this reducer, so "click a finding, open
 * its file, land on its line" is a state transition rather than a DOM query. The
 * viewer reads `selection`, the tree reads `expanded`, and the findings panel
 * reads `activeFindingId` — none of them reach into each other.
 */

export type FileSelection = {
  readonly path: string;
  /** Line to reveal and mark, when the navigation carried one. */
  readonly line: number | null;
  /** What caused the selection. Drives whether the viewer scrolls. */
  readonly origin: "tree" | "finding" | "url";
};

export type InspectorState = {
  readonly selection: FileSelection | null;
  readonly expanded: ReadonlySet<string>;
  readonly activeFindingId: string | null;
  /** Increments on every navigation that should move the viewport. */
  readonly revealToken: number;
};

export type InspectorAction =
  | { readonly type: "select-file"; readonly path: string }
  | { readonly type: "toggle-directory"; readonly path: string }
  | { readonly type: "expand-directories"; readonly paths: readonly string[] }
  | {
      readonly type: "open-finding";
      readonly findingId: string;
      readonly path: string | null;
      readonly line: number | null;
      /** Directories to open so the file is reachable in the tree. */
      readonly ancestors: readonly string[];
    }
  | { readonly type: "focus-finding"; readonly findingId: string | null }
  | { readonly type: "select-line"; readonly line: number | null };

export function createInspectorState(input: {
  readonly path: string | null;
  readonly line: number | null;
  readonly findingId: string | null;
  readonly expanded: readonly string[];
}): InspectorState {
  return {
    selection: input.path === null ? null : { path: input.path, line: input.line, origin: "url" },
    expanded: new Set(input.expanded),
    activeFindingId: input.findingId,
    revealToken: input.line === null ? 0 : 1,
  };
}

function withExpanded(
  expanded: ReadonlySet<string>,
  paths: readonly string[],
): ReadonlySet<string> {
  if (paths.every((path) => expanded.has(path))) {
    return expanded;
  }
  return new Set([...expanded, ...paths]);
}

export function inspectorReducer(state: InspectorState, action: InspectorAction): InspectorState {
  switch (action.type) {
    case "select-file": {
      if (state.selection?.path === action.path && state.selection.line === null) {
        return state;
      }
      return {
        ...state,
        selection: { path: action.path, line: null, origin: "tree" },
        activeFindingId: null,
      };
    }

    case "toggle-directory": {
      const expanded = new Set(state.expanded);
      if (!expanded.delete(action.path)) {
        expanded.add(action.path);
      }
      return { ...state, expanded };
    }

    case "expand-directories":
      return { ...state, expanded: withExpanded(state.expanded, action.paths) };

    case "open-finding": {
      // A finding without a file location still becomes the active finding; there
      // is simply nothing to reveal in the viewer.
      if (action.path === null) {
        return { ...state, activeFindingId: action.findingId };
      }
      return {
        selection: { path: action.path, line: action.line, origin: "finding" },
        expanded: withExpanded(state.expanded, action.ancestors),
        activeFindingId: action.findingId,
        revealToken: state.revealToken + 1,
      };
    }

    case "focus-finding":
      return state.activeFindingId === action.findingId
        ? state
        : { ...state, activeFindingId: action.findingId };

    case "select-line": {
      if (!state.selection || state.selection.line === action.line) {
        return state;
      }
      return { ...state, selection: { ...state.selection, line: action.line } };
    }
  }
}

/**
 * Findings anchored to one file and line. Several checks can legitimately report
 * the same location, so this returns every one of them — the UI must never let a
 * later finding overwrite an earlier one at the same anchor.
 */
export function findingsAtLocation(
  findings: readonly InspectorFinding[],
  path: string,
  line: number,
): readonly InspectorFinding[] {
  return findings.filter(
    (finding) => finding.evidence.path === path && finding.evidence.line === line,
  );
}

/** Line numbers in one file that carry at least one finding. */
export function findingLinesForFile(
  findings: readonly InspectorFinding[],
  path: string,
): ReadonlyMap<number, readonly InspectorFinding[]> {
  const byLine = new Map<number, InspectorFinding[]>();
  for (const finding of findings) {
    const { path: evidencePath, line } = finding.evidence;
    if (evidencePath !== path || line === null) {
      continue;
    }
    const existing = byLine.get(line);
    if (existing) {
      existing.push(finding);
    } else {
      byLine.set(line, [finding]);
    }
  }
  return byLine;
}

/** Findings that point at a file but not at a specific line. */
export function fileLevelFindings(
  findings: readonly InspectorFinding[],
  path: string,
): readonly InspectorFinding[] {
  return findings.filter(
    (finding) => finding.evidence.path === path && finding.evidence.line === null,
  );
}
