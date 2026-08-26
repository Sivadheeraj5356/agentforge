import type { WorkspaceEntry, WorkspaceReader } from "@agentforge/contracts";

import type { WorkspaceSnapshot } from "./snapshot";
import { isWithinDirectory, normalizeWorkspacePath } from "./paths";

/** Raised when a workspace file exists but cannot be read as the requested type. */
export class WorkspaceReadError extends Error {
  readonly relativePath: string;

  constructor(relativePath: string, reason: string) {
    super(`Cannot read ${relativePath}: ${reason}`);
    this.name = "WorkspaceReadError";
    this.relativePath = relativePath;
  }
}

/**
 * The only filesystem view validators get. Backed by an in-memory snapshot, so
 * reads are cheap, repeat-safe, and confined to the extracted workspace.
 *
 * `listFiles(dir)` is recursive; `listDirectories(dir)` returns immediate children.
 */
export function createWorkspaceReader(snapshot: WorkspaceSnapshot): WorkspaceReader {
  const byPath = new Map<string, WorkspaceEntry>(
    snapshot.entries.map((entry) => [entry.relativePath, entry]),
  );

  function childDirectories(directory: string): readonly string[] {
    const depth = directory === "" ? 0 : directory.split("/").length;
    return snapshot.directories.filter(
      (candidate) =>
        isWithinDirectory(candidate, directory) &&
        candidate !== directory &&
        candidate.split("/").length === depth + 1,
    );
  }

  return {
    resolveSafePath(relativePath: string): string {
      return normalizeWorkspacePath(relativePath);
    },
    exists(relativePath: string): boolean {
      const normalized = normalizeWorkspacePath(relativePath);
      return normalized === "" || byPath.has(normalized);
    },
    stat(relativePath: string): WorkspaceEntry | null {
      const normalized = normalizeWorkspacePath(relativePath);
      return byPath.get(normalized) ?? null;
    },
    readText(relativePath: string): string | null {
      const normalized = normalizeWorkspacePath(relativePath);
      return snapshot.text.get(normalized) ?? null;
    },
    readJson(relativePath: string): unknown {
      const normalized = normalizeWorkspacePath(relativePath);
      const entry = byPath.get(normalized);
      if (!entry || entry.kind !== "file") {
        return null;
      }
      const text = snapshot.text.get(normalized);
      if (text === undefined) {
        throw new WorkspaceReadError(normalized, "not readable as text");
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new WorkspaceReadError(normalized, "not valid JSON");
      }
    },
    listFiles(directoryPath = ""): readonly string[] {
      const directory = normalizeWorkspacePath(directoryPath);
      return snapshot.files.filter((file) => isWithinDirectory(file, directory));
    },
    listDirectories(directoryPath = ""): readonly string[] {
      return childDirectories(normalizeWorkspacePath(directoryPath));
    },
  };
}
