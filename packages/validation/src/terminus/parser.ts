import type {
  DiscoveredTask,
  NormalizedTaskMetadata,
  ParsedTask,
  TaskDocument,
  TaskInstruction,
  WorkspaceReader,
} from "@agentforge/contracts";

import { readFirstTaskDocument, withSchemaIssues } from "../metadata/document";
import {
  ClassicTaskYamlSchema,
  TerminusTaskTomlSchema,
  toSchemaIssues,
} from "../metadata/task-schema";
import { instructionPath, metadataPaths, taskExternalKey } from "./layout";

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string").slice(0, 32);
}

function nestedTable(raw: Readonly<Record<string, unknown>>, key: string): Record<string, unknown> {
  const value = raw[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Runs the runtime schema for the document's format once, during parsing. */
function validateDocument(document: TaskDocument): TaskDocument {
  const schema = document.format === "toml" ? TerminusTaskTomlSchema : ClassicTaskYamlSchema;
  const result = schema.safeParse(document.raw);
  return result.success ? document : withSchemaIssues(document, toSchemaIssues(result.error));
}

function readInstruction(
  workspace: WorkspaceReader,
  taskRoot: string,
  document: TaskDocument | null,
): TaskInstruction | null {
  const markdownPath = instructionPath(taskRoot);
  const markdown = workspace.readText(markdownPath);
  if (markdown !== null && markdown.trim().length > 0) {
    return {
      text: markdown.trim(),
      source: { path: markdownPath, line: null, fieldPath: null },
    };
  }

  const declared = asTrimmedString(document?.raw.instruction);
  if (document && declared) {
    return { text: declared, source: document.locate("instruction") };
  }

  return null;
}

function normalizeMetadata(
  raw: Readonly<Record<string, unknown>>,
  taskRoot: string,
): NormalizedTaskMetadata {
  const nested = nestedTable(raw, "metadata");
  const externalKey = taskExternalKey(taskRoot);
  return {
    externalKey,
    name: asTrimmedString(nested.name) ?? asTrimmedString(raw.name) ?? externalKey,
    difficulty: asTrimmedString(nested.difficulty) ?? asTrimmedString(raw.difficulty),
    category: asTrimmedString(nested.category) ?? asTrimmedString(raw.category),
    tags: asStringArray(nested.tags ?? raw.tags),
    authorName: asTrimmedString(nested.author_name) ?? asTrimmedString(raw.author_name),
    version: asTrimmedString(raw.version),
  };
}

/**
 * Terminus parse phase: one metadata document read, one schema pass, one
 * instruction read. The result is cached on the context for every validator.
 */
export function parseTerminusTask(workspace: WorkspaceReader, task: DiscoveredTask): ParsedTask {
  const found = readFirstTaskDocument(workspace, metadataPaths(task.rootPath));
  const document = found ? validateDocument(found) : null;
  const instruction = readInstruction(workspace, task.rootPath, document);

  return {
    definition: {
      rootPath: task.rootPath,
      externalKey: task.externalKey,
      metadata: normalizeMetadata(document?.raw ?? {}, task.rootPath),
      instruction,
    },
    document,
  };
}
