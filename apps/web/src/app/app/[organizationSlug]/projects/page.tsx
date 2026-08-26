import type { ReactElement } from "react";
import { ProjectListQuerySchema } from "@agentforge/contracts";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { EmptyProjects } from "@/components/empty-projects";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import { CreateProjectDialog } from "@/modules/projects/components/create-project-dialog";
import { ProjectFilters } from "@/modules/projects/components/project-filters";
import { ProjectList } from "@/modules/projects/components/project-list";
import {
  canManageProjects,
  listProjects,
  organizationHasAnyProjects,
  type Project,
} from "@/modules/projects/server/projects";

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web projects list");
  const { organizationSlug } = await params;
  const rawSearch = await searchParams;
  const organization = await requireOrganizationBySlug(organizationSlug);
  const canManage = canManageProjects(organization.role);
  const parsedQuery = ProjectListQuerySchema.safeParse({
    status: typeof rawSearch.status === "string" ? rawSearch.status : undefined,
    q: typeof rawSearch.q === "string" ? rawSearch.q : undefined,
    sort: typeof rawSearch.sort === "string" ? rawSearch.sort : undefined,
  });
  const query = parsedQuery.success ? parsedQuery.data : ProjectListQuerySchema.parse({});

  let projects: Project[] = [];
  let hasAnyProjects = false;
  let loadError: string | undefined;
  try {
    projects = await listProjects(organization.id, query);
    hasAnyProjects = projects.length > 0 || (await organizationHasAnyProjects(organization.id));
  } catch {
    projects = [];
    loadError = "Unable to load projects right now. Try again.";
  }

  const isDefaultEmpty = !loadError && !hasAnyProjects && query.status === "active" && !query.q;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.16em]">
            {organization.name}
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
            Organize evaluation work by project. Archive instead of deleting when a suite retires.
          </p>
        </div>
        {canManage ? <CreateProjectDialog organizationSlug={organization.slug} /> : null}
      </header>

      {loadError ? (
        <p role="alert" className="text-danger text-sm">
          {loadError}
        </p>
      ) : null}

      {isDefaultEmpty ? (
        <EmptyProjects organizationSlug={organization.slug} canCreate={canManage} />
      ) : (
        <div className="flex flex-col gap-6">
          <ProjectFilters organizationSlug={organization.slug} query={query} />
          <ProjectList organizationSlug={organization.slug} projects={projects} />
        </div>
      )}
    </div>
  );
}
