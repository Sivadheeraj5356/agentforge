"use client";

import { useActionState, useEffect, useId, useRef, type ReactElement } from "react";
import { Button, Input, Label, Textarea } from "@agentforge/ui";

import { createProjectAction, type ActionResult } from "@/modules/projects/actions";

const initialState: ActionResult | undefined = undefined;

export function CreateProjectDialog({
  organizationSlug,
}: {
  organizationSlug: string;
}): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);

  useEffect(() => {
    if (state?.ok === false) {
      dialogRef.current?.showModal();
    }
  }, [state]);

  return (
    <>
      <Button type="button" onClick={() => dialogRef.current?.showModal()}>
        Create project
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="border-border bg-surface text-foreground fixed left-1/2 top-1/2 z-50 w-[min(100%-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border p-0 shadow-md backdrop:bg-black/40 open:flex open:flex-col"
      >
        <form
          method="dialog"
          className="border-border flex items-start justify-between border-b px-5 py-4"
        >
          <div className="flex flex-col gap-1 pr-4">
            <h2 id={titleId} className="font-serif text-xl tracking-tight">
              Create project
            </h2>
            <p id={descriptionId} className="text-muted-foreground text-sm">
              Projects group related evaluations. Names stay plain text.
            </p>
          </div>
          <Button type="submit" variant="ghost" size="sm" aria-label="Close">
            Close
          </Button>
        </form>
        <form action={formAction} className="flex flex-col gap-4 px-5 py-4">
          <input type="hidden" name="organizationSlug" value={organizationSlug} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              name="name"
              required
              maxLength={120}
              autoComplete="off"
              placeholder="Harbor baseline suite"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              name="description"
              maxLength={2000}
              placeholder="Optional plain-text notes"
            />
          </div>
          {state && !state.ok ? (
            <p role="alert" className="text-danger text-sm">
              {state.error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => dialogRef.current?.close()}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
