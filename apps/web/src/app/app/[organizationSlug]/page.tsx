import type { ReactElement } from "react";
import Link from "next/link";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { EmptyProjects } from "@/components/empty-projects";
import { WorkspaceShortcutCards } from "@/components/workspace-shortcuts";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import {
  canManageProjects,
  listRecentProjects,
  type Project,
} from "@/modules/projects/server/projects";

function formatUpdatedAt(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function OrganizationHomePage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web organization home");
  const { organizationSlug } = await params;
  const organization = await requireOrganizationBySlug(organizationSlug);
  const canCreate = canManageProjects(organization.role);

  let recent: Project[] = [];
  let loadError: string | undefined;
  try {
    recent = await listRecentProjects(organization.id, 5);
  } catch {
    recent = [];
    loadError = "Unable to load recent projects.";
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.16em]">
          {organization.name}
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Evaluation Infrastructure
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Build private work environments, queue reproducible trials, and inspect results without
          running untrusted code in the control plane.
        </p>
      </header>

      <section aria-labelledby="projects-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="projects-heading" className="font-serif text-lg tracking-tight">
            Recent projects
          </h2>
          <Link
            href={`/app/${organization.slug}/projects`}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>

        {loadError ? (
          <p role="alert" className="text-danger text-sm">
            {loadError}
          </p>
        ) : null}

        {recent.length === 0 ? (
          <EmptyProjects
            organizationSlug={organization.slug}
            canCreate={canCreate}
            showBrowseLink
          />
        ) : (
          <ul className="border-border divide-border divide-y border-y">
            {recent.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/app/${organization.slug}/projects/${project.slug}`}
                  className="hover:bg-muted/50 flex items-baseline justify-between gap-4 px-1 py-3 transition-colors"
                >
                  <span className="font-medium tracking-tight">{project.name}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {formatUpdatedAt(project.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WorkspaceShortcutCards organizationSlug={organization.slug} />
    </div>
  );
}
