import { cache } from "react";
import type { Database } from "@agentforge/contracts";
import { WorkspaceRelativePathSchema } from "@agentforge/contracts";
import {
  buildTextFilePreview,
  inspectZip,
  manifestForTaskRoot,
  normalizeWorkspacePath,
  readZipEntry,
  WorkspacePathError,
  type ManifestEntry,
  type TextFilePreview,
} from "@agentforge/validation";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import { createArtifactStore } from "@/modules/validation/server/artifact-store";
import type { TaskRunContext } from "@/modules/tasks/server/task-runs";

type ValidationRunFileRow = Database["public"]["Tables"]["validation_run_files"]["Row"];

/**
 * Reading a file out of a validated package.
 *
 * The rules, in the order they are applied:
 *   1. The caller is authenticated, and is a member of the organization that owns
 *      the project (enforced by RLS in `resolveTaskRunContext`).
 *   2. The run belongs to that project and contains the task.
 *   3. The requested path normalizes to a workspace-relative path — no `..`, no
 *      absolute path, no drive letter, no UNC prefix, no NUL byte.
 *   4. The normalized path is in *this run's* manifest and inside the task's scope.
 *   5. Only then is an object key used, and it comes from the artifact row, never
 *      from the request.
 *
 * There is no endpoint that takes a storage key, a filesystem path, or an artifact
 * id from the client, and no signed URL is ever issued.
 */

export type FileReadErrorCode =
  "invalid-path" | "not-found" | "artifact-unavailable" | "unreadable";

export type FileReadResult =
  | { readonly ok: true; readonly path: string; readonly content: TextFilePreview }
  | { readonly ok: false; readonly error: FileReadErrorCode };

/** The files this run recorded. Also the allow-list: absent means unreadable. */
export const loadRunManifest = cache(async (runId: string): Promise<readonly ManifestEntry[]> => {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("validation_run_files")
    .select("path, byte_size")
    .eq("validation_run_id", runId)
    .order("path", { ascending: true });

  if (error) {
    throw new Error("Unable to load the file list for this run.");
  }

  return (data ?? []).map(
    (row: Pick<ValidationRunFileRow, "path" | "byte_size">): ManifestEntry => ({
      path: row.path,
      byteSize: Number(row.byte_size),
    }),
  );
});

/** Manifest narrowed to the task: its own root, plus files outside every task root. */
export async function loadTaskManifest(
  context: TaskRunContext,
  otherTaskRootPaths: readonly string[],
): Promise<readonly ManifestEntry[]> {
  const manifest = await loadRunManifest(context.run.id);
  return manifestForTaskRoot(manifest, context.task.rootPath, otherTaskRootPaths);
}

export function normalizeRequestedPath(rawPath: string): string | null {
  const shape = WorkspaceRelativePathSchema.safeParse(rawPath);
  if (!shape.success) {
    return null;
  }
  try {
    const normalized = normalizeWorkspacePath(shape.data);
    return normalized === "" ? null : normalized;
  } catch (error) {
    if (error instanceof WorkspacePathError) {
      return null;
    }
    throw error;
  }
}

/**
 * The whole authorization decision for a file read, as a pure function: shape,
 * confinement, and membership of the run's manifest. Isolated from I/O so it can
 * be tested directly against hostile input.
 */
export function resolveManifestEntry(
  scopedManifest: readonly ManifestEntry[],
  rawPath: string,
):
  | { readonly ok: true; readonly entry: ManifestEntry }
  | { readonly ok: false; readonly error: FileReadErrorCode } {
  const path = normalizeRequestedPath(rawPath);
  if (path === null) {
    return { ok: false, error: "invalid-path" };
  }
  const entry = scopedManifest.find((candidate) => candidate.path === path);
  return entry ? { ok: true, entry } : { ok: false, error: "not-found" };
}

async function loadArtifactBytes(context: TaskRunContext): Promise<Uint8Array | null> {
  const supabase = await createSupabaseServerClient();
  // RLS scopes artifacts to the organization, and the run's trigger guarantees the
  // artifact belongs to the project's organization.
  const { data, error } = await supabase
    .from("artifacts")
    .select("storage_key")
    .eq("id", context.run.artifact_id)
    .maybeSingle();

  if (error || !data?.storage_key) {
    return null;
  }

  try {
    return await createArtifactStore().get(data.storage_key);
  } catch {
    return null;
  }
}

/**
 * Reads one file from the run's pinned artifact and returns display-safe text.
 * Content is decoded and sanitized here; the client receives lines of text, never
 * markup and never raw bytes.
 */
export async function readTaskFile(
  context: TaskRunContext,
  rawPath: string,
  scopedManifest: readonly ManifestEntry[],
): Promise<FileReadResult> {
  assertNeverExecutesUserCode("task inspector file read");

  const resolved = resolveManifestEntry(scopedManifest, rawPath);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }
  const path = resolved.entry.path;

  const archiveBytes = await loadArtifactBytes(context);
  if (!archiveBytes) {
    return { ok: false, error: "artifact-unavailable" };
  }

  try {
    const bytes = readZipEntry(archiveBytes, inspectZip(archiveBytes), path);
    if (!bytes) {
      return { ok: false, error: "not-found" };
    }
    return { ok: true, path, content: buildTextFilePreview(bytes) };
  } catch {
    // A stored archive that no longer parses is an operational problem, not a
    // reviewer's problem. Say so plainly and keep the rest of the report usable.
    return { ok: false, error: "unreadable" };
  }
}
