import type { ReactElement } from "react";
import Link from "next/link";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { requireProjectBySlug } from "@/modules/projects/server/projects";
import { canManageProjects } from "@/modules/projects/permissions";
import { OutcomeBadge } from "@/modules/tasks/components/severity";
import { shortenHash } from "@/modules/tasks/model";
import { listProjectTasks } from "@/modules/tasks/server/task-runs";
import { UploadTaskDialog } from "@/modules/validation/components/upload-task-dialog";

export default async function ProjectHomePage({
  params,
}: {
  params: Promise<{ organizationSlug: string; projectSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web project home");
  const { organizationSlug, projectSlug } = await params;
  const { organization, project } = await requireProjectBySlug(organizationSlug, projectSlug);
  const canUpload = canManageProjects(organization.role) && project.status === "active";
  const tasks = await listProjectTasks(project.id);
  const projectPath = `/app/${organization.slug}/projects/${project.slug}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-3 border-b pb-6">
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]">
          <Link
            href={`/app/${organization.slug}/projects`}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Projects
          </Link>
          <span aria-hidden="true">/</span>
          <span>{project.slug}</span>
          {project.status === "archived" ? (
            <span className="text-warning normal-case tracking-normal">Archived</span>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">{project.name}</h1>
            {project.description ? (
              <p className="text-muted-foreground max-w-2xl whitespace-pre-wrap text-sm leading-relaxed">
                {project.description}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm italic">No description</p>
            )}
          </div>
          <Link
            href={`/app/${organization.slug}/projects/${project.slug}/settings`}
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            Settings
          </Link>
        </div>
      </header>

      <section aria-labelledby="tasks-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="tasks-heading" className="font-serif text-lg tracking-tight">
            Tasks
          </h2>
          {canUpload ? (
            <UploadTaskDialog organizationSlug={organization.slug} projectSlug={project.slug} />
          ) : (
            <p className="text-muted-foreground text-sm">
              {project.status === "archived"
                ? "Restore the project to upload a task package."
                : "Owner or admin role required to upload."}
            </p>
          )}
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Upload a Harbor/Terminus-style ZIP for structural validation. Scripts and containers are
          never executed in this control plane.
        </p>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-lg border border-dashed px-5 py-8 text-sm">
            No validated tasks yet.
          </p>
        ) : (
          <>
            <ul className="border-border divide-border divide-y border-y">
              {tasks.slice(0, 5).map((task) => (
                <li key={task.slug}>
                  <Link
                    href={`${projectPath}/tasks/${task.slug}`}
                    className="hover:bg-muted/50 flex flex-col gap-1 px-1 py-3 sm:flex-row sm:items-baseline sm:justify-between"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{task.name}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        run {task.latestRun.runNumber}
                        {task.latestRun.artifactContentHash
                          ? ` · ${shortenHash(task.latestRun.artifactContentHash, 10)}`
                          : ""}
                      </span>
                    </span>
                    <span className="flex items-baseline gap-4 text-xs">
                      <OutcomeBadge
                        outcome={task.latestRun.outcome}
                        status={task.latestRun.status}
                      />
                      <span className="text-muted-foreground font-mono tabular-nums">
                        {task.latestRun.counts.total === 1
                          ? "1 finding"
                          : `${task.latestRun.counts.total} findings`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {tasks.length > 5 ? (
              <Link
                href={`${projectPath}/tasks`}
                className="self-start text-sm underline underline-offset-4"
              >
                All {tasks.length} tasks
              </Link>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
