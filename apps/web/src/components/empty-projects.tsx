import type { ReactElement } from "react";
import Link from "next/link";
import { Button } from "@agentforge/ui";

import { CreateProjectDialog } from "@/modules/projects/components/create-project-dialog";

export function EmptyProjects({
  organizationSlug,
  canCreate,
  showBrowseLink = false,
}: {
  organizationSlug: string;
  canCreate: boolean;
  showBrowseLink?: boolean;
}): ReactElement {
  return (
    <div className="border-border bg-surface flex flex-col items-start gap-4 rounded-lg border border-dashed px-6 py-10">
      <div className="flex flex-col gap-1.5">
        <p className="text-foreground text-sm font-medium">No projects yet</p>
        <p className="text-muted-foreground max-w-md text-sm">
          Projects group task definitions and evaluation runs for this workspace.
        </p>
      </div>
      {canCreate ? (
        <CreateProjectDialog organizationSlug={organizationSlug} />
      ) : (
        <Button
          type="button"
          disabled
          aria-disabled="true"
          title="Owners and admins can create projects"
        >
          Create project
        </Button>
      )}
      {showBrowseLink ? (
        <Link
          href={`/app/${organizationSlug}/projects`}
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
        >
          Open projects
        </Link>
      ) : null}
    </div>
  );
}
