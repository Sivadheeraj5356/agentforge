import type { ZipInspection } from "../archive/zip";
import type { ManifestEntry } from "../workspace/tree";
import { normalizeWorkspacePath, WorkspacePathError } from "../workspace/paths";

/**
 * Flat file listing for an immutable artifact: the set of paths a reviewer may
 * open, and how big each one is. Derived from the archive's central directory, so
 * building it costs no extraction.
 *
 * The manifest is also the allow-list for file reads. A path that is not in it is
 * not readable, which is what keeps the read path from becoming a filesystem API.
 */
export function manifestFromInspection(inspection: ZipInspection): readonly ManifestEntry[] {
  const byPath = new Map<string, number>();

  for (const entry of inspection.entries) {
    if (entry.isDirectory) {
      continue;
    }
    let normalized: string;
    try {
      normalized = normalizeWorkspacePath(entry.path);
    } catch (error) {
      if (error instanceof WorkspacePathError) {
        continue;
      }
      throw error;
    }
    if (normalized !== "") {
      byPath.set(normalized, entry.uncompressedSize);
    }
  }

  return [...byPath.entries()]
    .map(([path, byteSize]): ManifestEntry => ({ path, byteSize }))
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

/** Files inside a task root, plus files that sit outside every task root. */
export function manifestForTaskRoot(
  manifest: readonly ManifestEntry[],
  taskRootPath: string,
  otherTaskRootPaths: readonly string[],
): readonly ManifestEntry[] {
  if (taskRootPath === "") {
    const excluded = otherTaskRootPaths.filter((root) => root !== "");
    return manifest.filter((entry) => !excluded.some((root) => entry.path.startsWith(`${root}/`)));
  }
  return manifest.filter((entry) => entry.path.startsWith(`${taskRootPath}/`));
}
