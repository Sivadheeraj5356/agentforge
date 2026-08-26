"use server";

import { OrganizationSlugSchema, ProjectSlugSchema } from "@agentforge/contracts";
import { MAX_UPLOAD_ARCHIVE_BYTES } from "@agentforge/validation";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { logServerEvent } from "@/lib/server-log";
import { canManageProjects } from "@/modules/projects/permissions";
import { requireProjectBySlug } from "@/modules/projects/server/projects";
import { executeValidationJob, ValidationJobError } from "@/modules/validation/server/ingest";

export type UploadTaskActionResult = { ok: true } | { ok: false; error: string };

export async function uploadTaskPackageAction(
  _prev: UploadTaskActionResult | undefined,
  formData: FormData,
): Promise<UploadTaskActionResult> {
  const orgParsed = OrganizationSlugSchema.safeParse(formData.get("organizationSlug"));
  const projectParsed = ProjectSlugSchema.safeParse(formData.get("projectSlug"));
  if (!orgParsed.success || !projectParsed.success) {
    return { ok: false, error: "Invalid project." };
  }

  const file = formData.get("package");
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose a ZIP task package." };
  }
  if (file.size > MAX_UPLOAD_ARCHIVE_BYTES) {
    return { ok: false, error: "The ZIP is larger than the upload limit." };
  }

  let organizationSlug: string;
  let projectSlug: string;
  let runId: string;

  try {
    const { organization, project } = await requireProjectBySlug(
      orgParsed.data,
      projectParsed.data,
    );
    if (!canManageProjects(organization.role)) {
      return { ok: false, error: "You do not have permission to upload tasks." };
    }
    if (project.status === "archived") {
      return { ok: false, error: "Archived projects cannot accept uploads." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await executeValidationJob({
      organizationId: organization.id,
      projectId: project.id,
      archiveBytes: bytes,
    });
    organizationSlug = organization.slug;
    projectSlug = project.slug;
    runId = result.runId;
    logServerEvent({
      level: "info",
      message: "task package uploaded",
      action: "artifact.uploaded",
      organizationId: organization.id,
      projectId: project.id,
    });
  } catch (error) {
    // Let framework control flow (notFound / redirect) keep propagating.
    unstable_rethrow(error);
    // Only ValidationJobError carries a user-safe message; anything else stays generic.
    if (error instanceof ValidationJobError) {
      return { ok: false, error: error.message };
    }
    logServerEvent({
      level: "error",
      message: error instanceof Error ? error.message : "task upload failed",
      action: "artifact.upload_failed",
    });
    return { ok: false, error: "Validation could not be started. Try the upload again." };
  }

  revalidatePath(`/app/${organizationSlug}/projects/${projectSlug}`);
  redirect(`/app/${organizationSlug}/projects/${projectSlug}/validations/${runId}`);
}
