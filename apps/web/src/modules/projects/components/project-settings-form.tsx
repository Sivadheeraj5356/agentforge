"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Input, Label, Textarea } from "@agentforge/ui";

import {
  archiveProjectAction,
  restoreProjectAction,
  updateProjectAction,
  type ActionResult,
} from "@/modules/projects/actions";
import type { Project } from "@/modules/projects/server/projects";

const initialState: ActionResult | undefined = undefined;

export function ProjectSettingsForm({
  organizationSlug,
  project,
  canManage,
}: {
  organizationSlug: string;
  project: Project;
  canManage: boolean;
}): ReactElement {
  const [updateState, updateAction, updatePending] = useActionState(
    updateProjectAction,
    initialState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveProjectAction,
    initialState,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreProjectAction,
    initialState,
  );

  const isArchived = project.status === "archived";

  return (
    <div className="flex max-w-xl flex-col gap-10">
      <form action={updateAction} className="flex flex-col gap-4">
        <input type="hidden" name="organizationSlug" value={organizationSlug} />
        <input type="hidden" name="projectSlug" value={project.slug} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="settings-name">Name</Label>
          <Input
            id="settings-name"
            name="name"
            required
            maxLength={120}
            defaultValue={project.name}
            disabled={!canManage || isArchived}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="settings-description">Description</Label>
          <Textarea
            id="settings-description"
            name="description"
            maxLength={2000}
            defaultValue={project.description ?? ""}
            disabled={!canManage || isArchived}
          />
          <p className="text-muted-foreground text-xs">
            Plain text only. Markdown is not rendered.
          </p>
        </div>
        {updateState?.ok === false ? (
          <p role="alert" className="text-danger text-sm">
            {updateState.error}
          </p>
        ) : null}
        {updateState?.ok === true ? (
          <p role="status" className="text-success text-sm">
            {updateState.message}
          </p>
        ) : null}
        {canManage && !isArchived ? (
          <div>
            <Button type="submit" disabled={updatePending}>
              {updatePending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : null}
      </form>

      {canManage ? (
        <section className="border-border flex flex-col gap-3 border-t pt-8">
          <h2 className="font-serif text-lg tracking-tight">
            {isArchived ? "Restore project" : "Archive project"}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {isArchived
              ? "Restoring makes this project active again. Its URL stays the same."
              : "Archiving hides the project from the default list. You can restore it later. Deletion is not available."}
          </p>
          {isArchived ? (
            <form action={restoreAction}>
              <input type="hidden" name="organizationSlug" value={organizationSlug} />
              <input type="hidden" name="projectSlug" value={project.slug} />
              {restoreState?.ok === false ? (
                <p role="alert" className="text-danger mb-3 text-sm">
                  {restoreState.error}
                </p>
              ) : null}
              <Button type="submit" disabled={restorePending}>
                {restorePending ? "Restoring…" : "Restore project"}
              </Button>
            </form>
          ) : (
            <form action={archiveAction}>
              <input type="hidden" name="organizationSlug" value={organizationSlug} />
              <input type="hidden" name="projectSlug" value={project.slug} />
              {archiveState?.ok === false ? (
                <p role="alert" className="text-danger mb-3 text-sm">
                  {archiveState.error}
                </p>
              ) : null}
              <Button type="submit" variant="danger" disabled={archivePending}>
                {archivePending ? "Archiving…" : "Archive project"}
              </Button>
            </form>
          )}
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">
          Only organization owners and admins can edit or archive projects.
        </p>
      )}
    </div>
  );
}
