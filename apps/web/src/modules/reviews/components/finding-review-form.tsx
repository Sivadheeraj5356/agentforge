"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Label, Textarea } from "@agentforge/ui";

import { submitFindingReviewAction, type ReviewActionResult } from "@/modules/reviews/actions";

const initial: ReviewActionResult | undefined = undefined;

export function FindingReviewForm({
  organizationSlug,
  findingId,
}: {
  organizationSlug: string;
  findingId: string;
}): ReactElement {
  const [state, action, pending] = useActionState(submitFindingReviewAction, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      <input type="hidden" name="findingId" value={findingId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`decision-${findingId}`}>Decision</Label>
        <select
          id={`decision-${findingId}`}
          name="decision"
          className="border-border bg-surface h-(--height-control) rounded-md border px-3 text-sm"
          required
        >
          <option value="accept">Accept</option>
          <option value="reject">Reject</option>
          <option value="comment">Comment</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`evidence-${findingId}`}>Evidence</Label>
        <Textarea id={`evidence-${findingId}`} name="evidenceSummary" required minLength={8} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`rationale-${findingId}`}>Rationale</Label>
        <Textarea id={`rationale-${findingId}`} name="rationale" required minLength={8} />
      </div>
      {pending ? <p className="text-muted-foreground text-sm">Submitting…</p> : null}
      {state && !state.ok ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? <p className="text-sm">{state.message}</p> : null}
      <Button type="submit">Submit independent review</Button>
      <p className="text-muted-foreground text-xs">
        A second reviewer cannot see your rationale until they submit their own review.
      </p>
    </form>
  );
}
