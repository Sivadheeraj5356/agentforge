import { normalizeWorkspacePath } from "./paths";

/** One file in an immutable artifact. Sizes come from the archive, never from a guess. */
export type ManifestEntry = {
  readonly path: string;
  readonly byteSize: number;
};

export type FileTreeFile = {
  readonly kind: "file";
  /** Full workspace-relative path. Also the stable node id. */
  readonly path: string;
  readonly name: string;
  readonly depth: number;
  readonly byteSize: number;
};

export type FileTreeDirectory = {
  readonly kind: "directory";
  readonly path: string;
  readonly name: string;
  readonly depth: number;
  readonly children: readonly FileTreeNode[];
  /** Files anywhere beneath this directory. */
  readonly fileCount: number;
};

export type FileTreeNode = FileTreeFile | FileTreeDirectory;

type MutableDirectory = {
  readonly directories: Map<string, MutableDirectory>;
  readonly files: Map<string, number>;
};

function emptyDirectory(): MutableDirectory {
  return { directories: new Map(), files: new Map() };
}

function compareNames(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function materialize(node: MutableDirectory, prefix: string, depth: number): FileTreeNode[] {
  const directories = [...node.directories.entries()]
    .sort(([left], [right]) => compareNames(left, right))
    .map(([name, child]): FileTreeDirectory => {
      const path = prefix === "" ? name : `${prefix}/${name}`;
      const children = materialize(child, path, depth + 1);
      return {
        kind: "directory",
        path,
        name,
        depth,
        children,
        fileCount: children.reduce(
          (total, entry) => total + (entry.kind === "file" ? 1 : entry.fileCount),
          0,
        ),
      };
    });

  const files = [...node.files.entries()]
    .sort(([left], [right]) => compareNames(left, right))
    .map(([name, byteSize]): FileTreeFile => ({
      kind: "file",
      path: prefix === "" ? name : `${prefix}/${name}`,
      name,
      depth,
      byteSize,
    }));

  // Directories before files, each alphabetical: the ordering a reviewer expects
  // from a file browser, and stable across runs.
  return [...directories, ...files];
}

/**
 * Builds a deterministic directory tree from a flat file manifest.
 *
 * Paths are normalized through the same rules the workspace reader uses, so a
 * manifest that somehow carries `..`, an absolute path, or a NUL byte is rejected
 * here rather than rendered. Entries that normalize to nothing are skipped.
 */
export function buildFileTree(entries: readonly ManifestEntry[]): readonly FileTreeNode[] {
  const root = emptyDirectory();

  for (const entry of entries) {
    const normalized = normalizeWorkspacePath(entry.path);
    if (normalized === "") {
      continue;
    }
    const segments = normalized.split("/");
    const fileName = segments.at(-1);
    if (fileName === undefined) {
      continue;
    }

    let cursor = root;
    for (const segment of segments.slice(0, -1)) {
      let next = cursor.directories.get(segment);
      if (!next) {
        next = emptyDirectory();
        cursor.directories.set(segment, next);
      }
      cursor = next;
    }
    cursor.files.set(fileName, Math.max(0, entry.byteSize));
  }

  return materialize(root, "", 0);
}

/** Every directory path on the way to `filePath`, outermost first. */
export function ancestorDirectories(filePath: string): readonly string[] {
  const normalized = normalizeWorkspacePath(filePath);
  if (normalized === "") {
    return [];
  }
  const segments = normalized.split("/").slice(0, -1);
  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
}

/** Flattens the tree to the nodes currently visible, honouring expanded directories. */
export function visibleTreeNodes(
  nodes: readonly FileTreeNode[],
  expanded: ReadonlySet<string>,
): readonly FileTreeNode[] {
  const visible: FileTreeNode[] = [];
  for (const node of nodes) {
    visible.push(node);
    if (node.kind === "directory" && expanded.has(node.path)) {
      visible.push(...visibleTreeNodes(node.children, expanded));
    }
  }
  return visible;
}
