import type {
  SourceLocation,
  TaskDocument,
  TaskDocumentFormat,
  TaskDocumentIssue,
  WorkspaceReader,
} from "@agentforge/contracts";

import { MetadataParseError } from "./errors";
import type { SchemaIssue } from "./task-schema";
import { parseTomlDocument } from "./toml";
import { parseYamlDocument } from "./yaml-lite";

function locationFor(
  path: string,
  keyLines: ReadonlyMap<string, number>,
  fieldPath: string,
): SourceLocation {
  const direct = keyLines.get(fieldPath);
  if (direct !== undefined) {
    return { path, line: direct, fieldPath: fieldPath || null };
  }
  // Fall back to the nearest declared ancestor, e.g. `metadata` for `metadata.author_name`.
  const segments = fieldPath.split(".");
  for (let depth = segments.length - 1; depth > 0; depth -= 1) {
    const ancestor = segments.slice(0, depth).join(".");
    const line = keyLines.get(ancestor);
    if (line !== undefined) {
      return { path, line, fieldPath: fieldPath || null };
    }
  }
  return { path, line: null, fieldPath: fieldPath || null };
}

function buildDocument(
  path: string,
  format: TaskDocumentFormat,
  raw: Record<string, unknown>,
  keyLines: ReadonlyMap<string, number>,
  issues: readonly TaskDocumentIssue[],
): TaskDocument {
  return {
    path,
    format,
    raw,
    locate: (fieldPath: string) => locationFor(path, keyLines, fieldPath),
    issues,
  };
}

const NO_LINES: ReadonlyMap<string, number> = new Map();

/**
 * Parses one metadata file into a typed document. Parse failures become document
 * issues rather than thrown errors, so the run still reports every other check.
 */
export function readTaskDocument(
  workspace: WorkspaceReader,
  documentPath: string,
): TaskDocument | null {
  const stat = workspace.stat(documentPath);
  if (!stat || stat.kind !== "file") {
    return null;
  }

  const format: TaskDocumentFormat = documentPath.endsWith(".toml") ? "toml" : "yaml";
  const text = workspace.readText(documentPath);
  if (text === null) {
    return buildDocument(documentPath, format, {}, NO_LINES, [
      {
        kind: "parse",
        message: "File is not readable as UTF-8 text within the inspection size limit.",
        location: { path: documentPath, line: null, fieldPath: null },
      },
    ]);
  }

  try {
    if (format === "toml") {
      const parsed = parseTomlDocument(text);
      return buildDocument(documentPath, format, parsed.table, parsed.keyLines, []);
    }
    const parsed = parseYamlDocument(text);
    return buildDocument(documentPath, format, parsed.map, parsed.keyLines, []);
  } catch (error) {
    const line = error instanceof MetadataParseError ? error.line : null;
    const message = error instanceof Error ? error.message : "Unable to parse document.";
    return buildDocument(documentPath, format, {}, NO_LINES, [
      { kind: "parse", message, location: { path: documentPath, line, fieldPath: null } },
    ]);
  }
}

/** Attaches runtime-schema issues found during the single parse phase. */
export function withSchemaIssues(
  document: TaskDocument,
  issues: readonly SchemaIssue[],
): TaskDocument {
  if (issues.length === 0) {
    return document;
  }
  const schemaIssues: TaskDocumentIssue[] = issues.map((issue) => ({
    kind: "schema",
    message: issue.message,
    location: document.locate(issue.fieldPath),
  }));
  return { ...document, issues: [...document.issues, ...schemaIssues] };
}

/** Issues whose field path sits under `prefix` (the owning validator reports them). */
export function schemaIssuesUnder(
  document: TaskDocument | null,
  prefix: string,
): readonly TaskDocumentIssue[] {
  if (!document) {
    return [];
  }
  return document.issues.filter((issue) => {
    if (issue.kind !== "schema") {
      return false;
    }
    const fieldPath = issue.location.fieldPath ?? "";
    return fieldPath === prefix || fieldPath.startsWith(`${prefix}.`);
  });
}

/** Schema issues not claimed by any section-owning validator. */
export function schemaIssuesOutside(
  document: TaskDocument | null,
  prefixes: readonly string[],
): readonly TaskDocumentIssue[] {
  if (!document) {
    return [];
  }
  return document.issues.filter((issue) => {
    if (issue.kind !== "schema") {
      return false;
    }
    const fieldPath = issue.location.fieldPath ?? "";
    return !prefixes.some((prefix) => fieldPath === prefix || fieldPath.startsWith(`${prefix}.`));
  });
}

export function parseIssues(document: TaskDocument | null): readonly TaskDocumentIssue[] {
  return document?.issues.filter((issue) => issue.kind === "parse") ?? [];
}

/** Returns the first document that exists among the candidate paths. */
export function readFirstTaskDocument(
  workspace: WorkspaceReader,
  candidatePaths: readonly string[],
): TaskDocument | null {
  for (const candidate of candidatePaths) {
    const document = readTaskDocument(workspace, candidate);
    if (document) {
      return document;
    }
  }
  return null;
}
