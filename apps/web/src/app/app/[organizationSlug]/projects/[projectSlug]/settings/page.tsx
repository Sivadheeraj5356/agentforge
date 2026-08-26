import type { ReactElement } from "react";
import Link from "next/link";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { ProjectSettingsForm } from "@/modules/projects/components/project-settings-form";
import { canManageProjects, requireProjectBySlug } from "@/modules/projects/server/projects";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; projectSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web project settings");
  const { organizationSlug, projectSlug } = await params;
  const { organization, project } = await requireProjectBySlug(organizationSlug, projectSlug);
  const canManage = canManageProjects(organization.role);

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-3 border-b pb-6">
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]">
          <Link
            href={`/app/${organization.slug}/projects/${project.slug}`}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            {project.name}
          </Link>
          <span aria-hidden="true">/</span>
          <span>Settings</span>
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Project settings</h1>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
          Update the name and description, or archive the project. Slugs stay fixed for stable URLs.
        </p>
      </header>

      <ProjectSettingsForm
        organizationSlug={organization.slug}
        project={project}
        canManage={canManage}
      />
    </div>
  );
}
