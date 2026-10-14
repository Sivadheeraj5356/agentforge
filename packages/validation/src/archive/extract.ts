import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { isSafeRelativePath } from "@agentforge/security";

import type { ZipInspection } from "./zip";
import { FINDING_CODES } from "../finding-codes";
import { extractZipEntries } from "./zip";
import { ArchiveError } from "./bytes";

export async function withTempWorkspace<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "agentforge-ingest-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function materializeZip(
  bytes: Uint8Array,
  inspection: ZipInspection,
  workspace: string,
): Promise<void> {
  const files = extractZipEntries(bytes, inspection);
  const root = path.resolve(workspace);

  for (const [relativePath, data] of files) {
    if (!isSafeRelativePath(relativePath)) {
      throw new ArchiveError(
        FINDING_CODES.ARCHIVE_PATH_TRAVERSAL,
        `Refusing to write unsafe path ${relativePath}`,
      );
    }
    const destination = path.resolve(root, relativePath);
    const relativeToRoot = path.relative(root, destination);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      throw new ArchiveError(
        FINDING_CODES.ARCHIVE_PATH_TRAVERSAL,
        `Refusing to write outside workspace: ${relativePath}`,
      );
    }
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, data, { flag: "wx" });
  }
}
