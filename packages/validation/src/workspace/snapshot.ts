import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { WorkspaceEntry } from "@agentforge/contracts";

import { MAX_TEXT_FILE_BYTES } from "../limits";

const TEXT_FILE_NAMES = new Set([
  "dockerfile",
  "docker-compose.yaml",
  "docker-compose.yml",
  "task.toml",
  "task.yaml",
  "task.yml",
  "instruction.md",
  "readme.md",
  "readme",
  "makefile",
  "requirements.txt",
]);

const TEXT_FILE_EXTENSIONS = new Set([
  ".md",
  ".toml",
  ".yaml",
  ".yml",
  ".sh",
  ".py",
  ".txt",
  ".json",
  ".cfg",
  ".ini",
]);

/** Text-file heuristic shared by the filesystem and in-memory workspaces. */
export function isProbablyText(relativePath: string): boolean {
  const base = path.posix.basename(relativePath).toLowerCase();
  if (TEXT_FILE_NAMES.has(base)) {
    return true;
  }
  return TEXT_FILE_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase());
}

function toPosix(relative: string): string {
  return relative.split(path.sep).join("/");
}

/**
 * Immutable, in-memory view of the extracted package. Loaded exactly once per run
 * so validators never re-read the filesystem.
 */
export type WorkspaceSnapshot = {
  readonly entries: readonly WorkspaceEntry[];
  readonly files: readonly string[];
  readonly directories: readonly string[];
  readonly text: ReadonlyMap<string, string>;
};

/**
 * Walks an extracted workspace directory. Symbolic links are skipped, so a link
 * that survived archive inspection can never be followed out of the workspace.
 */
export async function loadWorkspaceSnapshot(root: string): Promise<WorkspaceSnapshot> {
  const entries: WorkspaceEntry[] = [];
  const text = new Map<string, string>();
  const workspaceRoot = path.resolve(root);

  async function walk(current: string): Promise<void> {
    const listing = await readdir(current, { withFileTypes: true });
    for (const dirent of listing.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, dirent.name);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) {
        continue;
      }
      const relativePath = toPosix(path.relative(workspaceRoot, absolute));
      if (stat.isDirectory()) {
        entries.push({ relativePath, kind: "directory", byteSize: 0 });
        await walk(absolute);
        continue;
      }
      if (!stat.isFile()) {
        continue;
      }
      entries.push({ relativePath, kind: "file", byteSize: stat.size });
      if (isProbablyText(relativePath) && stat.size <= MAX_TEXT_FILE_BYTES) {
        text.set(relativePath, (await readFile(absolute)).toString("utf8"));
      }
    }
  }

  await walk(workspaceRoot);

  const files = entries
    .filter((entry) => entry.kind === "file")
    .map((entry) => entry.relativePath)
    .sort();
  const directories = entries
    .filter((entry) => entry.kind === "directory")
    .map((entry) => entry.relativePath)
    .sort();

  return { entries, files, directories, text };
}
