import type { ReactElement } from "react";
import Link from "next/link";

import type { Project } from "@/modules/projects/server/projects";

function formatUpdatedAt(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ProjectList({
  organizationSlug,
  projects,
}: {
  organizationSlug: string;
  projects: Project[];
}): ReactElement {
  if (projects.length === 0) {
    return <p className="text-muted-foreground text-sm">No projects match these filters.</p>;
  }

  return (
    <ul className="border-border divide-border divide-y border-y">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/app/${organizationSlug}/projects/${project.slug}`}
            className="hover:bg-muted/50 group flex flex-col gap-1 px-1 py-4 transition-colors sm:flex-row sm:items-baseline sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-foreground group-hover:text-accent font-medium tracking-tight">
                {project.name}
              </span>
              {project.description ? (
                <span className="text-muted-foreground line-clamp-1 text-sm">
                  {project.description}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm italic">No description</span>
              )}
            </div>
            <div className="text-muted-foreground flex shrink-0 items-center gap-3 font-mono text-xs">
              <span className="uppercase tracking-[0.12em]">{project.status}</span>
              <span>{formatUpdatedAt(project.updated_at)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
