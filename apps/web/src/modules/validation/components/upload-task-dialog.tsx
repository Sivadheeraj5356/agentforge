"use client";

import { useId, useRef, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@agentforge/ui";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  createUploadTargetAction,
  ingestUploadedTaskAction,
} from "@/modules/validation/direct-upload-actions";

const ARTIFACT_BUCKET = "agentforge-artifacts";
const MAX_BYTES = 32 * 1024 * 1024;

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
  const [sizeError, setSizeError] = useState<string | null>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem("package");
            const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
            if (!file) {
              setSizeError("Choose a ZIP task package.");
              return;
            }
            if (file.size > MAX_BYTES) {
              setSizeError("This ZIP is over 32 MB, the upload limit.");
              return;
            }
            setSizeError(null);
            setBusy(true);
            void (async () => {
              try {
                const target = await createUploadTargetAction({ organizationSlug, projectSlug });
                if (!target.ok) {
                  setSizeError(target.error);
                  return;
                }
                const { error } = await createSupabaseBrowserClient()
                  .storage.from(ARTIFACT_BUCKET)
                  .uploadToSignedUrl(target.path, target.token, file, {
                    contentType: "application/zip",
                  });
                if (error) {
                  setSizeError(`The upload to storage failed: ${error.message}`);
                  return;
                }
                const result = await ingestUploadedTaskAction({
                  organizationSlug,
                  projectSlug,
                  uploadId: target.uploadId,
                });
                if (!result.ok) {
                  setSizeError(result.error);
                  return;
                }
                router.push(result.redirectTo);
              } catch (error) {
                setSizeError(
                  `The upload failed: ${error instanceof Error ? error.message : "unknown error"}`,
                );
              } finally {
                setBusy(false);
              }
            })();
          }}
          className="flex flex-col gap-4 px-5 py-4"
        >
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
          {busy ? (
            <p role="status" className="text-muted-foreground text-sm">
              Uploading and validating…
            </p>
          ) : null}
          {sizeError ? (
            <p role="alert" className="text-danger text-sm">
              {sizeError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => dialogRef.current?.close()}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Validating…" : "Upload and validate"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
