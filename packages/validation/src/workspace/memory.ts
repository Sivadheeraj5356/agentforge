import type { WorkspaceEntry, WorkspaceReader } from "@agentforge/contracts";

import { MAX_TEXT_FILE_BYTES } from "../limits";
import { createWorkspaceReader } from "./reader";
import { isProbablyText, type WorkspaceSnapshot } from "./snapshot";

export type MemoryWorkspaceFile = {
  readonly path: string;
  readonly content: string;
};

function parentDirectories(filePath: string): readonly string[] {
  const segments = filePath.split("/");
  return segments
    .slice(0, -1)
    .map((_, index) => segments.slice(0, index + 1).join("/"))
    .filter((directory) => directory.length > 0);
}

/**
 * Workspace snapshot built from strings instead of a temp directory. Used by tests
 * and by callers that already hold the package in memory. Applies the same
 * text-file rules as the filesystem loader so behaviour matches production.
 */
export function createMemoryWorkspaceSnapshot(
  files: readonly MemoryWorkspaceFile[],
): WorkspaceSnapshot {
  const encoder = new TextEncoder();
  const text = new Map<string, string>();
  const directories = new Set<string>();
  const fileEntries: WorkspaceEntry[] = [];

  for (const file of [...files].sort((left, right) => (left.path < right.path ? -1 : 1))) {
    const byteSize = encoder.encode(file.content).byteLength;
    fileEntries.push({ relativePath: file.path, kind: "file", byteSize });
    if (isProbablyText(file.path) && byteSize <= MAX_TEXT_FILE_BYTES) {
      text.set(file.path, file.content);
    }
    for (const directory of parentDirectories(file.path)) {
      directories.add(directory);
    }
  }

  const directoryEntries: WorkspaceEntry[] = [...directories]
    .sort()
    .map((relativePath) => ({ relativePath, kind: "directory", byteSize: 0 }));

  return {
    entries: [...directoryEntries, ...fileEntries],
    files: fileEntries.map((entry) => entry.relativePath).sort(),
    directories: directoryEntries.map((entry) => entry.relativePath),
    text,
  };
}

export function createMemoryWorkspace(files: readonly MemoryWorkspaceFile[]): WorkspaceReader {
  return createWorkspaceReader(createMemoryWorkspaceSnapshot(files));
}
