"use server";

import { OrganizationSlugSchema, ProjectSlugSchema } from "@agentforge/contracts";
import { MAX_UPLOAD_ARCHIVE_BYTES } from "@agentforge/validation";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { logServerEvent } from "@/lib/server-log";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import { canManageProjects } from "@/modules/projects/permissions";
import { requireProjectBySlug } from "@/modules/projects/server/projects";
import { ARTIFACT_BUCKET } from "@/modules/validation/server/supabase-artifact-store";
import { executeValidationJob, ValidationJobError } from "@/modules/validation/server/ingest";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UploadTargetResult =
  { ok: true; uploadId: string; path: string; token: string } | { ok: false; error: string };

export type IngestUploadResult = { ok: true; redirectTo: string } | { ok: false; error: string };

/** The object path is derived only from server-verified org, project and user ids. */
function tempPath(organizationId: string, projectId: string, userId: string, uploadId: string) {
  return `orgs/${organizationId}/uploads/${projectId}/${userId}/${uploadId}.zip`;
}

async function authorize(organizationSlug: unknown, projectSlug: unknown) {
  const org = OrganizationSlugSchema.safeParse(organizationSlug);
  const proj = ProjectSlugSchema.safeParse(projectSlug);
  if (!org.success || !proj.success) {
    return { error: "Invalid project." } as const;
  }
  const user = await requireAuthenticatedUser();
  const { organization, project } = await requireProjectBySlug(org.data, proj.data);
  if (!canManageProjects(organization.role)) {
    return { error: "You do not have permission to upload tasks." } as const;
  }
  if (project.status === "archived") {
    return { error: "Archived projects cannot accept uploads." } as const;
  }
  return { organization, project, userId: user.id } as const;
}

export async function createUploadTargetAction(input: {
  organizationSlug: string;
  projectSlug: string;
}): Promise<UploadTargetResult> {
  try {
    const auth = await authorize(input.organizationSlug, input.projectSlug);
    if ("error" in auth) {
      return { ok: false, error: auth.error ?? "Not allowed." };
    }
    const uploadId = crypto.randomUUID();
    const path = tempPath(auth.organization.id, auth.project.id, auth.userId, uploadId);
    const { data, error } = await createSupabaseServiceRoleClient()
      .storage.from(ARTIFACT_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw new Error(`signed upload url failed: ${error?.message ?? "no data"}`);
    }
    return { ok: true, uploadId, path, token: data.token };
  } catch (error) {
    unstable_rethrow(error);
    logServerEvent({
      level: "error",
      message: error instanceof Error ? error.message : "upload target failed",
      action: "artifact.upload_failed",
    });
    return { ok: false, error: "Could not start the upload. Try again." };
  }
}

export async function ingestUploadedTaskAction(input: {
  organizationSlug: string;
  projectSlug: string;
  uploadId: string;
}): Promise<IngestUploadResult> {
  let storage: ReturnType<
    ReturnType<typeof createSupabaseServiceRoleClient>["storage"]["from"]
  > | null = null;
  let path = "";
  try {
    if (!UUID.test(input.uploadId)) {
      return { ok: false, error: "Invalid upload." };
    }
    const auth = await authorize(input.organizationSlug, input.projectSlug);
    if ("error" in auth) {
      return { ok: false, error: auth.error ?? "Not allowed." };
    }
    path = tempPath(auth.organization.id, auth.project.id, auth.userId, input.uploadId);
    storage = createSupabaseServiceRoleClient().storage.from(ARTIFACT_BUCKET);
    const { data, error } = await storage.download(path);
    if (error || !data) {
      return { ok: false, error: "The uploaded file was not found. Try again." };
    }
    if (data.size > MAX_UPLOAD_ARCHIVE_BYTES) {
      return { ok: false, error: "The ZIP is larger than the 32 MB upload limit." };
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    const result = await executeValidationJob({
      organizationId: auth.organization.id,
      projectId: auth.project.id,
      archiveBytes: bytes,
    });
    logServerEvent({
      level: "info",
      message: "task package uploaded",
      action: "artifact.uploaded",
      organizationId: auth.organization.id,
      projectId: auth.project.id,
    });
    revalidatePath(`/app/${auth.organization.slug}/projects/${auth.project.slug}`);
    return {
      ok: true,
      redirectTo: `/app/${auth.organization.slug}/projects/${auth.project.slug}/validations/${result.runId}`,
    };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ValidationJobError) {
      return { ok: false, error: error.message };
    }
    logServerEvent({
      level: "error",
      message: error instanceof Error ? error.message : "task upload failed",
      action: "artifact.upload_failed",
    });
    return { ok: false, error: "Validation could not be started. Try the upload again." };
  } finally {
    if (storage && path) {
      await storage.remove([path]).catch(() => undefined);
    }
  }
}
