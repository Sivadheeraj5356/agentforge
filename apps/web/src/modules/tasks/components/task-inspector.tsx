"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ValidationOutcome, ValidationRunStatus } from "@agentforge/contracts";
import type { FileTreeNode, TextFilePreview } from "@agentforge/validation/browser";
import { ancestorDirectories } from "@agentforge/validation/browser";
import { cn } from "@agentforge/ui";

import { FileTree } from "@/modules/tasks/components/file-tree";
import { FindingsPanel } from "@/modules/tasks/components/findings-panel";
import {
  filterFindings,
  findingFiltersToQuery,
  type FindingFilters,
} from "@/modules/tasks/filters";
import type { FindingCounts, InspectorFinding } from "@/modules/tasks/model";
import {
  createInspectorState,
  fileLevelFindings,
  findingLinesForFile,
  findingsAtLocation,
  inspectorReducer,
} from "@/modules/tasks/navigation";

/**
 * The three-pane shell.
 *
 * Everything the reviewer changes — filters, selection, which finding is open —
 * lives in one typed reducer plus the URL. The server already delivered the report
 * and the file manifest; the only thing fetched from the client is the body of the
 * file that is currently selected.
 */

const FileViewer = dynamic(
  async () => (await import("@/modules/tasks/components/file-viewer")).FileViewer,
  {
    ssr: false,
    loading: () => <ViewerSkeleton />,
  },
);

type LoadState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly content: TextFilePreview }
  | { readonly status: "error"; readonly code: string };

const MOBILE_PANES = ["files", "file", "findings"] as const;
type MobilePane = (typeof MOBILE_PANES)[number];

const PANE_LABEL: Record<MobilePane, string> = {
  files: "Files",
  file: "File",
  findings: "Findings",
};

const MIN_TREE_WIDTH = 180;
const MAX_TREE_WIDTH = 480;
const TREE_RESIZE_STEP = 24;

const FILE_ERROR_COPY: Record<string, string> = {
  "invalid-path": "That path is not part of this package.",
  "not-found": "This file is not in the validated package for this task.",
  "artifact-unavailable":
    "The stored package for this run could not be read. The report is still accurate; the file contents are not available.",
  unreadable: "The stored package could not be opened, so this file cannot be shown.",
};

export type TaskInspectorProps = {
  readonly fileEndpoint: string;
  readonly tree: readonly FileTreeNode[];
  readonly findings: readonly InspectorFinding[];
  readonly counts: FindingCounts;
  readonly outcome: ValidationOutcome | null;
  readonly status: ValidationRunStatus;
  readonly errorMessage: string | null;
  readonly initialFilters: FindingFilters;
  readonly initialPath: string | null;
  readonly initialLine: number | null;
  /** Server-rendered checks + provenance disclosure, kept out of the client bundle. */
  readonly disclosures: ReactNode;
};

export function TaskInspector({
  fileEndpoint,
  tree,
  findings,
  counts,
  outcome,
  status,
  errorMessage,
  initialFilters,
  initialPath,
  initialLine,
  disclosures,
}: TaskInspectorProps): ReactElement {
  const [filters, setFilters] = useState<FindingFilters>(initialFilters);
  const [state, dispatch] = useReducer(
    inspectorReducer,
    {
      path: initialPath,
      line: initialLine,
      findingId: null,
      expanded: initialPath ? ancestorDirectories(initialPath) : topLevelDirectories(tree),
    },
    createInspectorState,
  );
  const [file, setFile] = useState<LoadState>({ status: "idle" });
  const [mobilePane, setMobilePane] = useState<MobilePane>("findings");
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [treeWidth, setTreeWidth] = useState(240);
  const requestRef = useRef(0);

  const selectedPath = state.selection?.path ?? null;

  // Load the selected file. A stale response can never win: every request carries
  // a sequence number, and the in-flight one is aborted when the selection moves.
  useEffect(() => {
    if (selectedPath === null) {
      setFile({ status: "idle" });
      return;
    }

    const sequence = requestRef.current + 1;
    requestRef.current = sequence;
    const controller = new AbortController();
    setFile({ status: "loading" });

    void (async () => {
      try {
        const response = await fetch(`${fileEndpoint}?path=${encodeURIComponent(selectedPath)}`, {
          signal: controller.signal,
        });
        if (requestRef.current !== sequence) {
          return;
        }
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          const code =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : "unreadable";
          setFile({ status: "error", code });
          return;
        }
        const body = (await response.json()) as { content: TextFilePreview };
        if (requestRef.current === sequence) {
          setFile({ status: "ready", content: body.content });
        }
      } catch {
        if (controller.signal.aborted || requestRef.current !== sequence) {
          return;
        }
        setFile({ status: "error", code: "unreadable" });
      }
    })();

    return () => controller.abort();
  }, [fileEndpoint, selectedPath]);

  // Filters and selection belong in the URL so a report link is shareable, but
  // they must not re-run the server render: this is a history update, not a route
  // change.
  useEffect(() => {
    const params = new URLSearchParams(findingFiltersToQuery(filters));
    if (selectedPath) {
      params.set("file", selectedPath);
    }
    if (state.selection?.line != null) {
      params.set("line", String(state.selection.line));
    }
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query.length > 0 ? `?${query}` : ""}`,
    );
  }, [filters, selectedPath, state.selection?.line]);

  const visibleFindings = useMemo(() => filterFindings(findings, filters), [findings, filters]);

  const findingsByLine = useMemo<ReadonlyMap<number, readonly InspectorFinding[]>>(
    () => (selectedPath ? findingLinesForFile(findings, selectedPath) : new Map()),
    [findings, selectedPath],
  );

  const openFinding = useCallback(
    (finding: InspectorFinding) => {
      const path = finding.evidence.path;
      dispatch({
        type: "open-finding",
        findingId: finding.id,
        path,
        line: finding.evidence.line,
        ancestors: path ? ancestorDirectories(path) : [],
      });
      if (path) {
        setMobilePane("file");
      }
    },
    [dispatch],
  );

  const selectLine = useCallback(
    (line: number) => {
      dispatch({ type: "select-line", line });
      if (!selectedPath) {
        return;
      }
      const atLine = findingsAtLocation(findings, selectedPath, line);
      dispatch({ type: "focus-finding", findingId: atLine[0]?.id ?? null });
    },
    [findings, selectedPath],
  );

  const selectFile = useCallback((path: string) => {
    dispatch({ type: "select-file", path });
    setMobilePane("file");
  }, []);

  const resizeTree = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const delta =
      event.key === "ArrowLeft"
        ? -TREE_RESIZE_STEP
        : event.key === "ArrowRight"
          ? TREE_RESIZE_STEP
          : 0;
    if (delta === 0) {
      return;
    }
    event.preventDefault();
    setTreeWidth((width) => clampTreeWidth(width + delta));
  };

  const startPointerResize = (startX: number, startWidth: number): void => {
    const onMove = (event: PointerEvent): void => {
      setTreeWidth(clampTreeWidth(startWidth + event.clientX - startX));
    };
    const onUp = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const lineFindings =
    selectedPath && state.selection?.line != null
      ? findingsAtLocation(findings, selectedPath, state.selection.line)
      : [];
  const wholeFileFindings = selectedPath ? fileLevelFindings(findings, selectedPath) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="tablist"
        aria-label="Inspector panes"
        className="border-border flex gap-1 border-b pb-2 md:hidden"
      >
        {MOBILE_PANES.map((pane) => (
          <button
            key={pane}
            type="button"
            role="tab"
            aria-selected={mobilePane === pane}
            onClick={() => setMobilePane(pane)}
            className={cn(
              "rounded-sm px-2.5 py-1 text-sm",
              mobilePane === pane
                ? "bg-accent/10 text-accent font-medium"
                : "text-muted-foreground hover:bg-muted/70",
            )}
          >
            {PANE_LABEL[pane]}
          </button>
        ))}
      </div>

      <div
        className="border-border md:min-h-128 flex min-h-0 flex-1 md:h-[calc(100dvh-17rem)] md:rounded-md md:border"
        style={{ ["--tree-width" as string]: `${treeWidth}px` }}
      >
        <section
          aria-label="Files"
          className={cn(
            "border-border min-h-0 shrink-0 flex-col overflow-hidden md:flex md:border-e",
            mobilePane === "files" ? "flex flex-1" : "hidden",
            treeCollapsed ? "md:w-10" : "md:w-(--tree-width)",
          )}
        >
          <PaneHeader>
            {treeCollapsed ? null : <span>Files</span>}
            <button
              type="button"
              onClick={() => setTreeCollapsed((collapsed) => !collapsed)}
              aria-expanded={!treeCollapsed}
              className="text-muted-foreground hover:text-foreground ms-auto hidden rounded-sm text-xs underline-offset-4 hover:underline md:inline"
            >
              {treeCollapsed ? "Show" : "Hide"}
              <span className="sr-only"> file tree</span>
            </button>
          </PaneHeader>
          <div className={cn("min-h-0 flex-1 overflow-auto", treeCollapsed && "md:hidden")}>
            <FileTree
              nodes={tree}
              expanded={state.expanded}
              selectedPath={selectedPath}
              findings={findings}
              onSelectFile={selectFile}
              onToggleDirectory={(path) => dispatch({ type: "toggle-directory", path })}
            />
          </div>
        </section>

        {treeCollapsed ? null : (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize file tree"
            aria-valuenow={treeWidth}
            aria-valuemin={MIN_TREE_WIDTH}
            aria-valuemax={MAX_TREE_WIDTH}
            tabIndex={0}
            onKeyDown={resizeTree}
            onPointerDown={(event) => {
              event.preventDefault();
              startPointerResize(event.clientX, treeWidth);
            }}
            className="hover:bg-accent/40 -mx-px hidden w-px shrink-0 cursor-col-resize bg-transparent md:block"
          />
        )}

        <section
          aria-label="File contents"
          className={cn(
            "border-border min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex md:border-e",
            mobilePane === "file" ? "flex" : "hidden",
          )}
        >
          <PaneHeader>
            <span className="truncate font-mono text-[11px] normal-case tracking-normal">
              {selectedPath ?? "No file selected"}
            </span>
          </PaneHeader>

          {selectedPath === null ? (
            <EmptyPane
              title="Pick a file"
              detail="Choose a file on the left, or open a finding to jump straight to its evidence."
            />
          ) : file.status === "loading" || file.status === "idle" ? (
            <ViewerSkeleton />
          ) : file.status === "error" ? (
            <EmptyPane
              title="This file could not be shown"
              detail={FILE_ERROR_COPY[file.code] ?? FILE_ERROR_COPY.unreadable ?? ""}
            />
          ) : (
            <FileViewer
              path={selectedPath}
              content={file.content}
              findingsByLine={findingsByLine}
              activeLine={state.selection?.line ?? null}
              revealToken={state.revealToken}
              onSelectLine={selectLine}
            />
          )}

          {lineFindings.length > 0 || wholeFileFindings.length > 0 ? (
            <div className="border-border bg-surface/60 flex flex-col gap-1 border-t px-3 py-2">
              {lineFindings.length > 0 ? (
                <p aria-live="polite" className="text-xs">
                  {lineFindings.length === 1
                    ? "1 finding at this location:"
                    : `${lineFindings.length} findings at this location:`}{" "}
                  {lineFindings.map((finding, index) => (
                    <span key={finding.id}>
                      {index > 0 ? ", " : null}
                      <button
                        type="button"
                        onClick={() => openFinding(finding)}
                        className="rounded-sm underline underline-offset-4"
                      >
                        {finding.code}
                      </button>
                    </span>
                  ))}
                </p>
              ) : null}
              {wholeFileFindings.length > 0 ? (
                <p className="text-muted-foreground text-xs">
                  {wholeFileFindings.length === 1
                    ? "1 finding about this file as a whole"
                    : `${wholeFileFindings.length} findings about this file as a whole`}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section
          aria-label="Validation"
          className={cn(
            "min-h-0 shrink-0 flex-col overflow-hidden md:flex md:w-80 lg:w-96",
            mobilePane === "findings" ? "flex flex-1" : "hidden",
          )}
        >
          <PaneHeader>
            <span>Validation</span>
          </PaneHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <FindingsPanel
              findings={findings}
              visibleFindings={visibleFindings}
              filters={filters}
              counts={counts}
              outcome={outcome}
              status={status}
              errorMessage={errorMessage}
              activeFindingId={state.activeFindingId}
              onFiltersChange={setFilters}
              onOpenFinding={openFinding}
            />
            <div className="border-border mt-auto border-t">{disclosures}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function clampTreeWidth(width: number): number {
  return Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, width));
}

function topLevelDirectories(tree: readonly FileTreeNode[]): readonly string[] {
  return tree.filter((node) => node.kind === "directory").map((node) => node.path);
}

function PaneHeader({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="border-border bg-surface/80 text-muted-foreground sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] backdrop-blur">
      {children}
    </div>
  );
}

function EmptyPane({ title, detail }: { title: string; detail: string }): ReactElement {
  return (
    <div className="flex flex-1 flex-col items-start gap-2 px-4 py-8">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">{detail}</p>
    </div>
  );
}

function ViewerSkeleton(): ReactElement {
  return (
    <div aria-hidden="true" className="flex flex-1 flex-col gap-2 px-4 py-4">
      {Array.from({ length: 10 }, (_, index) => (
        <div
          key={index}
          className="bg-muted h-3 rounded-sm"
          style={{ width: `${45 + ((index * 13) % 45)}%` }}
        />
      ))}
    </div>
  );
}
