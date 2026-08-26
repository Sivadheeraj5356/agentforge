import { MAX_WORKSPACE_PATH_LENGTH } from "../limits";

/** Raised when a path would leave the extracted workspace. */
export class WorkspacePathError extends Error {
  readonly relativePath: string;

  constructor(relativePath: string, reason: string) {
    super(`Unsafe workspace path (${reason}): ${relativePath}`);
    this.name = "WorkspacePathError";
    this.relativePath = relativePath;
  }
}

/**
 * Normalizes a caller-supplied path to a workspace-relative POSIX path.
 * Rejects absolute paths, drive letters, parent traversal, and NUL bytes.
 * An empty result means the workspace root.
 */
export function normalizeWorkspacePath(relativePath: string): string {
  if (relativePath.includes("\0")) {
    throw new WorkspacePathError(relativePath, "NUL byte");
  }
  if (relativePath.length > MAX_WORKSPACE_PATH_LENGTH) {
    throw new WorkspacePathError(relativePath, "too long");
  }
  const unified = relativePath.replaceAll("\\", "/");
  if (unified.startsWith("/") || /^[A-Za-z]:/.test(unified)) {
    throw new WorkspacePathError(relativePath, "absolute path");
  }

  const segments: string[] = [];
  for (const segment of unified.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      throw new WorkspacePathError(relativePath, "parent traversal");
    }
    segments.push(segment);
  }
  return segments.join("/");
}

/** Joins path parts, dropping empty parts so a root-level task works. */
export function joinWorkspacePath(...parts: readonly string[]): string {
  return parts.filter((part) => part.length > 0).join("/");
}

export function isWithinDirectory(candidate: string, directory: string): boolean {
  if (directory === "") {
    return true;
  }
  return candidate === directory || candidate.startsWith(`${directory}/`);
}
