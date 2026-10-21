"use server";

import {
  CreateProjectInputSchema,
  OrganizationSlugSchema,
  ProjectSlugSchema,
  UpdateProjectInputSchema,
} from "@agentforge/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logServerEvent } from "@/lib/server-log";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import {
  archiveProject,
  canManageProjects,
  createProject,
  requireProjectBySlug,
  restoreProject,
  updateProject,
} from "@/modules/projects/server/projects";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function mapProjectError(error: unknown, fallback: string): string {
  // Framework navigation errors can arise when a stale form loses access.
  // Keep the action denied without exposing internal error names to the user.
  if (error instanceof Error && error.message.startsWith("NEXT_")) {
    return fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function revalidateProjectPaths(organizationSlug: string, projectSlug?: string): void {
  revalidatePath(`/app/${organizationSlug}`);
  revalidatePath(`/app/${organizationSlug}/projects`);
  if (projectSlug) {
    revalidatePath(`/app/${organizationSlug}/projects/${projectSlug}`);
    revalidatePath(`/app/${organizationSlug}/projects/${projectSlug}/settings`);
  }
}

export async function createProjectAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const orgParsed = OrganizationSlugSchema.safeParse(formData.get("organizationSlug"));
  if (!orgParsed.success) {
    return { ok: false, error: "Invalid organization." };
  }

  const parsed = CreateProjectInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the project name and description." };
  }

  let organizationSlug: string;
  let projectSlug: string;

  try {
    const organization = await requireOrganizationBySlug(orgParsed.data);
    if (!canManageProjects(organization.role)) {
      return { ok: false, error: "You do not have permission to create projects." };
    }

    const project = await createProject(organization.id, parsed.data);
    organizationSlug = organization.slug;
    projectSlug = project.slug;
    logServerEvent({
      level: "info",
      message: "project created",
      action: "project.created",
      organizationId: organization.id,
      projectId: project.id,
    });
  } catch (error) {
    return { ok: false, error: mapProjectError(error, "Unable to create project.") };
  }

  revalidateProjectPaths(organizationSlug, projectSlug);
  redirect(`/app/${organizationSlug}/projects/${projectSlug}`);
}

export async function updateProjectAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const orgParsed = OrganizationSlugSchema.safeParse(formData.get("organizationSlug"));
  const projectParsed = ProjectSlugSchema.safeParse(formData.get("projectSlug"));
  if (!orgParsed.success || !projectParsed.success) {
    return { ok: false, error: "Invalid project." };
  }

  const parsed = UpdateProjectInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the project name and description." };
  }

  try {
    const { organization, project } = await requireProjectBySlug(
      orgParsed.data,
      projectParsed.data,
    );
    if (!canManageProjects(organization.role)) {
      return { ok: false, error: "You do not have permission to edit this project." };
    }

    await updateProject(project.id, organization.id, parsed.data);
    logServerEvent({
      level: "info",
      message: "project updated",
      action: "project.updated",
      organizationId: organization.id,
      projectId: project.id,
    });
    revalidateProjectPaths(organization.slug, project.slug);
    return { ok: true, message: "Project updated." };
  } catch (error) {
    return { ok: false, error: mapProjectError(error, "Unable to update project.") };
  }
}

export async function archiveProjectAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const orgParsed = OrganizationSlugSchema.safeParse(formData.get("organizationSlug"));
  const projectParsed = ProjectSlugSchema.safeParse(formData.get("projectSlug"));
  if (!orgParsed.success || !projectParsed.success) {
    return { ok: false, error: "Invalid project." };
  }

  let organizationSlug: string;

  try {
    const { organization, project } = await requireProjectBySlug(
      orgParsed.data,
      projectParsed.data,
    );
    if (!canManageProjects(organization.role)) {
      return { ok: false, error: "You do not have permission to archive this project." };
    }

    await archiveProject(project.id, organization.id);
    organizationSlug = organization.slug;
    logServerEvent({
      level: "info",
      message: "project archived",
      action: "project.archived",
      organizationId: organization.id,
      projectId: project.id,
    });
    revalidateProjectPaths(organization.slug, project.slug);
  } catch (error) {
    return { ok: false, error: mapProjectError(error, "Unable to archive project.") };
  }

  redirect(`/app/${organizationSlug}/projects?status=archived`);
}

export async function restoreProjectAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const orgParsed = OrganizationSlugSchema.safeParse(formData.get("organizationSlug"));
  const projectParsed = ProjectSlugSchema.safeParse(formData.get("projectSlug"));
  if (!orgParsed.success || !projectParsed.success) {
    return { ok: false, error: "Invalid project." };
  }

  let organizationSlug: string;
  let projectSlug: string;

  try {
    const { organization, project } = await requireProjectBySlug(
      orgParsed.data,
      projectParsed.data,
    );
    if (!canManageProjects(organization.role)) {
      return { ok: false, error: "You do not have permission to restore this project." };
    }

    await restoreProject(project.id, organization.id);
    organizationSlug = organization.slug;
    projectSlug = project.slug;
    logServerEvent({
      level: "info",
      message: "project restored",
      action: "project.restored",
      organizationId: organization.id,
      projectId: project.id,
    });
    revalidateProjectPaths(organization.slug, project.slug);
  } catch (error) {
    return { ok: false, error: mapProjectError(error, "Unable to restore project.") };
  }

  redirect(`/app/${organizationSlug}/projects/${projectSlug}`);
}
