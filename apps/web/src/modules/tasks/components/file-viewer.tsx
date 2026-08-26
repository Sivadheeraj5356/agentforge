"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { TextFilePreview } from "@agentforge/validation/browser";
import { cn, Input } from "@agentforge/ui";

import {
  detectLanguage,
  tokenizeLine,
  type HighlightLanguage,
  type Token,
} from "@/modules/tasks/highlight";
import { SeverityIcon } from "@/modules/tasks/components/severity";
import type { InspectorFinding } from "@/modules/tasks/model";
import { validationSeverityRank, type ValidationSeverity } from "@agentforge/contracts";

/**
 * Read-only file viewer.
 *
 * Content arrives as an array of already-sanitized lines and is rendered as text
 * nodes inside spans. There is no HTML parsing, no Markdown rendering, and no
 * `dangerouslySetInnerHTML` anywhere in this file — a package cannot contribute
 * markup to the page, only characters.
 */

const TOKEN_CLASS: Record<Token["kind"], string> = {
  plain: "",
  comment: "text-muted-foreground italic",
  string: "text-success",
  keyword: "text-accent",
  number: "text-warning",
  key: "text-foreground font-medium",
};

function LineTokens({
  text,
  language,
}: {
  text: string;
  language: HighlightLanguage;
}): ReactElement {
  const tokens = useMemo(() => tokenizeLine(text, language), [text, language]);

  return (
    <>
      {tokens.map((token, index) => (
        <span key={index} className={TOKEN_CLASS[token.kind]}>
          {token.text}
        </span>
      ))}
    </>
  );
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

function worstSeverity(findings: readonly InspectorFinding[]): ValidationSeverity {
  return findings.reduce<ValidationSeverity>(
    (worst, finding) =>
      validationSeverityRank(finding.severity) < validationSeverityRank(worst)
        ? finding.severity
        : worst,
    "info",
  );
}

export type FileViewerProps = {
  readonly path: string;
  readonly content: TextFilePreview;
  readonly findingsByLine: ReadonlyMap<number, readonly InspectorFinding[]>;
  readonly activeLine: number | null;
  /** Changes whenever a navigation should move the viewport. */
  readonly revealToken: number;
  readonly onSelectLine: (line: number) => void;
};

export function FileViewer({
  path,
  content,
  findingsByLine,
  activeLine,
  revealToken,
  onSelectLine,
}: FileViewerProps): ReactElement {
  const language = useMemo(() => detectLanguage(path), [path]);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const searchId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return [] as readonly number[];
    }
    const found: number[] = [];
    content.lines.forEach((line, index) => {
      if (line.toLowerCase().includes(needle)) {
        found.push(index + 1);
      }
    });
    return found;
  }, [content.lines, query]);

  useEffect(() => {
    setQuery("");
    setMatchIndex(0);
  }, [path]);

  useEffect(() => {
    setMatchIndex(0);
  }, [query]);

  const revealLine = matches[matchIndex] ?? activeLine;

  useEffect(() => {
    if (revealLine === null || revealLine === undefined) {
      return;
    }
    const target = containerRef.current?.querySelector<HTMLElement>(`[data-line="${revealLine}"]`);
    target?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [revealLine, revealToken]);

  if (content.mode === "metadata") {
    return (
      <ViewerNotice title="This file is too large to display">
        {`${formatBytes(content.byteSize)} of content. AgentForge shows files up to 2 MB; the rest of the package is unaffected.`}
      </ViewerNotice>
    );
  }

  if (content.mode === "binary") {
    return (
      <ViewerNotice title="This file is not text">
        {`${formatBytes(content.byteSize)} of data that is not valid UTF-8. Binary content is never rendered.`}
      </ViewerNotice>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border bg-surface/60 flex flex-wrap items-center gap-3 border-b px-3 py-2">
        <label htmlFor={searchId} className="text-muted-foreground text-xs">
          Find in file
        </label>
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, 200))}
          placeholder="Search this file"
          className="h-7 w-44 text-xs"
        />
        {query.trim().length > 0 ? (
          <div className="flex items-center gap-2">
            <p aria-live="polite" className="text-muted-foreground font-mono text-xs tabular-nums">
              {matches.length === 0 ? "no matches" : `${matchIndex + 1} of ${matches.length} lines`}
            </p>
            {matches.length > 1 ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="border-border hover:bg-muted rounded-sm border px-1.5 py-0.5 text-xs"
                  onClick={() =>
                    setMatchIndex((index) => (index - 1 + matches.length) % matches.length)
                  }
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="border-border hover:bg-muted rounded-sm border px-1.5 py-0.5 text-xs"
                  onClick={() => setMatchIndex((index) => (index + 1) % matches.length)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {content.truncated ? (
          <p className="text-warning ms-auto text-xs">
            {`Showing the first ${content.lines.length} of ${content.totalLines ?? "?"} lines`}
          </p>
        ) : null}
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-xs leading-[1.6]">
          <caption className="sr-only">{`Contents of ${path}`}</caption>
          <tbody>
            {content.lines.map((line, index) => {
              const lineNumber = index + 1;
              const lineFindings = findingsByLine.get(lineNumber) ?? [];
              const isActive = activeLine === lineNumber;
              const isMatch = matches[matchIndex] === lineNumber;

              return (
                <tr
                  key={lineNumber}
                  data-line={lineNumber}
                  data-testid={lineFindings.length > 0 ? "evidence-line" : undefined}
                  onClick={() => onSelectLine(lineNumber)}
                  className={cn(
                    "group align-top",
                    lineFindings.length > 0 && "bg-warning/8 cursor-pointer",
                    isActive &&
                      "bg-accent/15 outline-accent/40 outline -outline-offset-1",
                    !isActive && isMatch && "bg-accent/10",
                  )}
                >
                  <td className="text-muted-foreground/70 w-12 select-none border-e border-transparent px-2 text-end tabular-nums">
                    {lineNumber}
                  </td>
                  <td className="w-5 select-none px-0.5 text-center">
                    {lineFindings.length > 0 ? (
                      <span className={severityToneClass(worstSeverity(lineFindings))}>
                        <SeverityIcon severity={worstSeverity(lineFindings)} />
                        <span className="sr-only">
                          {lineFindings.length === 1
                            ? "1 finding at this line"
                            : `${lineFindings.length} findings at this line`}
                        </span>
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-pre-wrap wrap-break-word pe-3 ps-1">
                    {line.length === 0 ? "\u00A0" : <LineTokens text={line} language={language} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {content.hasClippedLines ? (
          <p className="text-muted-foreground border-border border-t px-3 py-2 text-xs">
            At least one line was longer than 2000 characters and has been cut.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ViewerNotice({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-1 flex-col items-start gap-2 px-4 py-8">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">{children}</p>
    </div>
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
