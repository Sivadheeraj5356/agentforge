import type { Database } from "@agentforge/contracts";
import {
  ProjectListQuerySchema,
  ProjectSlugSchema,
  projectSlugWithSuffix,
  slugifyProjectName,
  type CreateProjectInput,
  type ProjectListQuery,
  type UpdateProjectInput,
} from "@agentforge/contracts";
import { cache } from "react";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import {
  requireOrganizationBySlug,
  type AccessibleOrganization,
} from "@/modules/organizations/server/access";
import { canManageProjects } from "@/modules/projects/permissions";

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export { canManageProjects };

const MAX_SLUG_ATTEMPTS = 8;

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }
  return error.code === "23505" || /duplicate key|unique/i.test(error.message ?? "");
}

export async function listProjects(
  organizationId: string,
  rawQuery: Partial<ProjectListQuery> | Record<string, string | string[] | undefined> = {},
): Promise<Project[]> {
  await requireAuthenticatedUser();
  const query = ProjectListQuerySchema.parse({
    status: typeof rawQuery.status === "string" ? rawQuery.status : undefined,
    q: typeof rawQuery.q === "string" ? rawQuery.q : undefined,
    sort: typeof rawQuery.sort === "string" ? rawQuery.sort : undefined,
  });

  const supabase = await createSupabaseServerClient();
  let request = supabase.from("projects").select("*").eq("organization_id", organizationId);

  if (query.status !== "all") {
    request = request.eq("status", query.status);
  }

  if (query.q) {
    const safe = query.q.replace(/[%_,.()]/g, " ").trim();
    if (safe.length > 0) {
      const pattern = `%${safe}%`;
      request = request.or(`name.ilike."${pattern}",description.ilike."${pattern}"`);
    }
  }

  switch (query.sort) {
    case "updated_asc":
      request = request.order("updated_at", { ascending: true });
      break;
    case "name_asc":
      request = request.order("name", { ascending: true });
      break;
    case "name_desc":
      request = request.order("name", { ascending: false });
      break;
    case "updated_desc":
    default:
      request = request.order("updated_at", { ascending: false });
      break;
  }

  const { data, error } = await request;
  if (error) {
    throw new Error("Unable to load projects.");
  }
  return data ?? [];
}

export async function organizationHasAnyProjects(organizationId: string): Promise<boolean> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error("Unable to load projects.");
  }
  return (count ?? 0) > 0;
}

export async function listRecentProjects(organizationId: string, limit = 5): Promise<Project[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("Unable to load recent projects.");
  }
  return data ?? [];
}

export async function getProjectBySlug(
  organizationId: string,
  rawSlug: string,
): Promise<Project | null> {
  await requireAuthenticatedUser();
  const parsed = ProjectSlugSchema.safeParse(rawSlug);
  if (!parsed.success) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("slug", parsed.data)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load project.");
  }
  return data;
}

export const requireProjectBySlug = cache(
  async (
    organizationSlug: string,
    projectSlug: string,
  ): Promise<{
    organization: AccessibleOrganization;
    project: Project;
  }> => {
    const organization = await requireOrganizationBySlug(organizationSlug);
    const project = await getProjectBySlug(organization.id, projectSlug);
    if (!project) {
      notFound();
    }
    return { organization, project };
  },
);

export async function createProject(
  organizationId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const baseSlug = slugifyProjectName(input.name);

  let lastError: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const slug = projectSlugWithSuffix(baseSlug, attempt);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        organization_id: organizationId,
        name: input.name,
        slug,
        description: input.description ?? null,
        status: "active",
        created_by: user.id,
        archived_at: null,
      })
      .select("*")
      .single();

    if (!error && data) {
      return data;
    }

    lastError = error;
    if (!isUniqueViolation(error)) {
      break;
    }
  }

  if (isUniqueViolation(lastError)) {
    throw new Error("A project with a similar name already exists. Try a different name.");
  }
  throw new Error("Unable to create project.");
}

export async function updateProject(
  projectId: string,
  organizationId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .update({
      name: input.name,
      description: input.description,
    })
    .eq("id", projectId)
    .eq("organization_id", organizationId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Unable to update project.");
  }
  return data;
}

export async function archiveProject(projectId: string, organizationId: string): Promise<Project> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Unable to archive project.");
  }
  return data;
}

export async function restoreProject(projectId: string, organizationId: string): Promise<Project> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .update({
      status: "active",
      archived_at: null,
    })
    .eq("id", projectId)
    .eq("organization_id", organizationId)
    .eq("status", "archived")
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Unable to restore project.");
  }
  return data;
}
