"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Input, Label } from "@agentforge/ui";

import { createWebhookEndpointAction, type LabActionResult } from "@/modules/lab/actions";

const initial: LabActionResult | undefined = undefined;

export function CreateWebhookForm({
  organizationSlug,
}: {
  organizationSlug: string;
}): ReactElement {
  const [state, action, pending] = useActionState(createWebhookEndpointAction, initial);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      <Label htmlFor="webhook-url">Signed webhook URL</Label>
      <Input
        id="webhook-url"
        name="url"
        required
        placeholder="http://127.0.0.1:8787/hooks"
      />
      <p className="text-muted-foreground text-xs">
        Events: evaluation.completed, evaluation.failed, regression.detected. The evaluator POSTs
        with X-AgentForge-Signature. GitHub App checks stay behind an unconfigured adapter.
      </p>
      {pending ? <p className="text-muted-foreground text-sm">Saving…</p> : null}
      {state && !state.ok ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? <p className="text-sm break-all">{state.message}</p> : null}
      <Button type="submit" variant="outline">
        Create webhook
      </Button>
    </form>
  );
}
