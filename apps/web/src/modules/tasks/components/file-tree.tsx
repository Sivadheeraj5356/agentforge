"use client";

import { useCallback, useMemo, useRef, type KeyboardEvent, type ReactElement } from "react";
import type { FileTreeNode } from "@agentforge/validation/browser";
import { visibleTreeNodes } from "@agentforge/validation/browser";
import { cn } from "@agentforge/ui";

import { SeverityIcon } from "@/modules/tasks/components/severity";
import type { InspectorFinding } from "@/modules/tasks/model";
import type { ValidationSeverity } from "@agentforge/contracts";
import { validationSeverityRank } from "@agentforge/contracts";

/**
 * Read-only tree over the immutable artifact manifest. It never mutates anything
 * and never loads a file body — selecting a node only reports the path upward.
 *
 * Keyboard model follows the ARIA tree pattern: one tab stop, arrows move, Right
 * opens a directory, Left closes it or steps to the parent, Enter/Space activates.
 */

function FolderIcon({ open }: { open: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" className="size-3 shrink-0">
      {open ? (
        <path
          d="M1 9.5V3.2h3.2l1 1.3H11v5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M1 9.5V2.5h3.6l1 1.3H11v5.7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function FileIcon(): ReactElement {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" className="size-3 shrink-0">
      <path
        d="M3 1.2h4l2.2 2.2V10.8H3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M7 1.4v2.2h2.1" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }): ReactElement {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
      className={cn(
        "size-3 shrink-0 transition-transform duration-150 motion-reduce:transition-none",
        open && "rotate-90",
      )}
    >
      <path
        d="M4.5 2.5 8 6l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatBytes(byteSize: number): string {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }
  if (byteSize < 1024 * 1024) {
    return `${Math.round(byteSize / 1024)} KB`;
  }
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

function severityToneClass(severity: ValidationSeverity): string {
  switch (severity) {
    case "critical":
    case "error":
      return "text-danger";
    case "warning":
      return "text-warning";
    case "info":
      return "text-muted-foreground";
  }
}

export type FileTreeProps = {
  readonly nodes: readonly FileTreeNode[];
  readonly expanded: ReadonlySet<string>;
  readonly selectedPath: string | null;
  readonly findings: readonly InspectorFinding[];
  readonly onSelectFile: (path: string) => void;
  readonly onToggleDirectory: (path: string) => void;
};

export function FileTree({
  nodes,
  expanded,
  selectedPath,
  findings,
  onSelectFile,
  onToggleDirectory,
}: FileTreeProps): ReactElement {
  const listRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => visibleTreeNodes(nodes, expanded), [nodes, expanded]);

  const severityByPath = useMemo(() => {
    const byPath = new Map<string, ValidationSeverity>();
    for (const finding of findings) {
      const path = finding.evidence.path;
      if (!path) {
        continue;
      }
      const current = byPath.get(path);
      if (!current || validationSeverityRank(finding.severity) < validationSeverityRank(current)) {
        byPath.set(path, finding.severity);
      }
    }
    return byPath;
  }, [findings]);

  const activePath = selectedPath ?? visible[0]?.path ?? null;

  const focusNode = useCallback((path: string) => {
    listRef.current?.querySelector<HTMLElement>(`[data-tree-path="${CSS.escape(path)}"]`)?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, node: FileTreeNode, index: number): void => {
      const move = (delta: number): void => {
        const next = visible[index + delta];
        if (next) {
          event.preventDefault();
          focusNode(next.path);
        }
      };

      switch (event.key) {
        case "ArrowDown":
          move(1);
          return;
        case "ArrowUp":
          move(-1);
          return;
        case "Home": {
          const first = visible[0];
          if (first) {
            event.preventDefault();
            focusNode(first.path);
          }
          return;
        }
        case "End": {
          const last = visible.at(-1);
          if (last) {
            event.preventDefault();
            focusNode(last.path);
          }
          return;
        }
        case "ArrowRight":
          if (node.kind === "directory") {
            event.preventDefault();
            if (expanded.has(node.path)) {
              move(1);
            } else {
              onToggleDirectory(node.path);
            }
          }
          return;
        case "ArrowLeft": {
          event.preventDefault();
          if (node.kind === "directory" && expanded.has(node.path)) {
            onToggleDirectory(node.path);
            return;
          }
          const parent = node.path.split("/").slice(0, -1).join("/");
          if (parent.length > 0) {
            focusNode(parent);
          }
          return;
        }
        case "Enter":
        case " ":
          event.preventDefault();
          if (node.kind === "directory") {
            onToggleDirectory(node.path);
          } else {
            onSelectFile(node.path);
          }
          return;
        default:
          return;
      }
    },
    [expanded, focusNode, onSelectFile, onToggleDirectory, visible],
  );

  if (nodes.length === 0) {
    return (
      <p className="text-muted-foreground px-3 py-4 text-sm leading-relaxed">
        This run did not record a file list, so there is nothing to browse.
      </p>
    );
  }

  return (
    <div ref={listRef} role="tree" aria-label="Task files" className="py-1">
      {visible.map((node, index) => {
        const isDirectory = node.kind === "directory";
        const isOpen = isDirectory && expanded.has(node.path);
        const isSelected = node.kind === "file" && node.path === selectedPath;
        const severity = severityByPath.get(node.path);

        return (
          <div
            key={node.path}
            role="treeitem"
            data-tree-path={node.path}
            aria-level={node.depth + 1}
            aria-expanded={isDirectory ? isOpen : undefined}
            aria-selected={node.kind === "file" ? isSelected : undefined}
            tabIndex={node.path === activePath ? 0 : -1}
            onKeyDown={(event) => handleKeyDown(event, node, index)}
            onClick={() => (isDirectory ? onToggleDirectory(node.path) : onSelectFile(node.path))}
            style={{ paddingInlineStart: `${0.5 + node.depth * 0.75}rem` }}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 py-1 pe-2 text-sm",
              isSelected
                ? "bg-accent/10 text-foreground font-medium"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {isDirectory ? <Chevron open={isOpen} /> : <span className="size-3 shrink-0" />}
            <span className={cn(isSelected ? "text-accent" : "opacity-70")}>
              {isDirectory ? <FolderIcon open={isOpen} /> : <FileIcon />}
            </span>
            <span className="truncate">{node.name}</span>
            {severity ? (
              <span className={cn("ms-auto", severityToneClass(severity))}>
                <SeverityIcon severity={severity} />
                <span className="sr-only">{`Has ${severity} finding`}</span>
              </span>
            ) : null}
            {node.kind === "file" && !severity ? (
              <span className="text-muted-foreground/70 ms-auto font-mono text-[10px] tabular-nums">
                {formatBytes(node.byteSize)}
              </span>
            ) : null}
            {isDirectory && !severity ? (
              <span className="text-muted-foreground/70 ms-auto font-mono text-[10px] tabular-nums">
                {node.fileCount}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
