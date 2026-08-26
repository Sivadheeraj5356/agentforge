import { isSafeRelativePath } from "@agentforge/security";

import { FINDING_CODES } from "../finding-codes";
import { MAX_ARCHIVE_PATH_LENGTH } from "../limits";
import { ArchiveError } from "./bytes";

export function normalizeArchivePath(rawName: string): string {
  const replaced = rawName.replaceAll("\\", "/");
  if (replaced !== rawName) {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_UNEXPECTED_TYPE,
      "Archive entry uses backslash separators.",
    );
  }
  return replaced;
}

export function assertSafeArchivePath(rawName: string): string {
  const name = normalizeArchivePath(rawName);
  if (!name || name === "." || name === "./") {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_UNEXPECTED_TYPE,
      "Archive entry has an empty path.",
    );
  }
  if (name.length > MAX_ARCHIVE_PATH_LENGTH) {
    throw new ArchiveError(FINDING_CODES.ARCHIVE_PATH_TRAVERSAL, "Archive entry path is too long.");
  }
  if (name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.startsWith("//")) {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_ABSOLUTE_PATH,
      `Archive entry uses an absolute path: ${name}`,
    );
  }
  const trimmed = name.endsWith("/") ? name.slice(0, -1) : name;
  if (!isSafeRelativePath(trimmed) && trimmed !== "") {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_PATH_TRAVERSAL,
      `Archive entry path is not a safe relative path: ${name}`,
    );
  }
  if (name.split("/").some((segment) => segment === ".." || segment.includes("\0"))) {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_PATH_TRAVERSAL,
      `Archive entry path is not a safe relative path: ${name}`,
    );
  }
  return name;
}
