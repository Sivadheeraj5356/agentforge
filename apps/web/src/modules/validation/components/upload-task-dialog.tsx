"use client";

import { useActionState, useEffect, useId, useRef, type ReactElement } from "react";
import { Button, Input, Label } from "@agentforge/ui";

import { uploadTaskPackageAction, type UploadTaskActionResult } from "@/modules/validation/actions";

const initialState: UploadTaskActionResult | undefined = undefined;

export function UploadTaskDialog({
  organizationSlug,
  projectSlug,
}: {
  organizationSlug: string;
  projectSlug: string;
}): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [state, formAction, pending] = useActionState(uploadTaskPackageAction, initialState);

  useEffect(() => {
    if (state?.ok === false) {
      dialogRef.current?.showModal();
    }
  }, [state]);

  return (
    <>
      <Button type="button" onClick={() => dialogRef.current?.showModal()}>
        Add task
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="border-border bg-surface text-foreground fixed left-1/2 top-1/2 z-50 w-[min(100%-2rem,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border p-0 shadow-md backdrop:bg-black/40 open:flex open:flex-col"
      >
        <form
          method="dialog"
          className="border-border flex items-start justify-between border-b px-5 py-4"
        >
          <div className="flex flex-col gap-1 pr-4">
            <h2 id={titleId} className="font-serif text-xl tracking-tight">
              Upload task package
            </h2>
            <p id={descriptionId} className="text-muted-foreground text-sm">
              ZIP only. AgentForge inspects structure; it never runs scripts, Dockerfiles, or tests.
            </p>
          </div>
          <Button type="submit" variant="ghost" size="sm" aria-label="Close">
            Close
          </Button>
        </form>
        <form action={formAction} className="flex flex-col gap-4 px-5 py-4">
          <input type="hidden" name="organizationSlug" value={organizationSlug} />
          <input type="hidden" name="projectSlug" value={projectSlug} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-package">Task package (ZIP)</Label>
            <Input
              id="task-package"
              name="package"
              type="file"
              accept=".zip,application/zip"
              required
            />
          </div>
          {pending ? (
            <p role="status" className="text-muted-foreground text-sm">
              Uploading and validating…
            </p>
          ) : null}
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
              {pending ? "Validating…" : "Upload and validate"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
