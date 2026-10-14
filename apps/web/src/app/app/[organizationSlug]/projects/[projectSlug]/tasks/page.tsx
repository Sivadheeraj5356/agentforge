import type { ReactElement } from "react";
import Link from "next/link";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { requireProjectBySlug } from "@/modules/projects/server/projects";
import { Breadcrumbs } from "@/modules/tasks/components/task-header";
import { OutcomeBadge } from "@/modules/tasks/components/severity";
import { shortenHash } from "@/modules/tasks/model";
import { listProjectTasks } from "@/modules/tasks/server/task-runs";

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; projectSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web project tasks");
  const { organizationSlug, projectSlug } = await params;
  const { organization, project } = await requireProjectBySlug(organizationSlug, projectSlug);
  const tasks = await listProjectTasks(project.id);
  const projectPath = `/app/${organization.slug}/projects/${project.slug}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-3 border-b pb-6">
        <Breadcrumbs
          trail={[
            { label: "Projects", href: `/app/${organization.slug}/projects` },
            { label: project.name, href: projectPath },
            { label: "Tasks" },
          ]}
        />
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Every task AgentForge found inside a validated package. Open one to read its files
          alongside the findings. Nothing here was built, installed, or executed.
        </p>
      </header>

      {tasks.length === 0 ? (
        <div className="border-border flex flex-col items-start gap-3 rounded-lg border border-dashed px-5 py-8">
          <p className="text-sm font-medium">No tasks yet</p>
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            Upload a Harbor/Terminus task package from the project page. Once it validates, the
            tasks it contains appear here.
          </p>
          <Link href={projectPath} className="text-sm underline underline-offset-4">
            Go to {project.name}
          </Link>
        </div>
      ) : (
        <ul className="border-border divide-border divide-y border-y">
          {tasks.map((task) => (
            <li key={task.slug}>
              <Link
                href={`${projectPath}/tasks/${task.slug}`}
                className="hover:bg-muted/50 flex flex-col gap-1.5 px-1 py-4 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{task.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {task.slug}
                    {" · "}
                    {task.runCount === 1 ? "1 run" : `${task.runCount} runs`}
                    {task.latestRun.artifactContentHash
                      ? ` · ${shortenHash(task.latestRun.artifactContentHash)}`
                      : ""}
                  </span>
                </span>
                <span className="flex items-baseline gap-4 text-xs">
                  <OutcomeBadge outcome={task.latestRun.outcome} status={task.latestRun.status} />
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
      )}
    </div>
  );
}
