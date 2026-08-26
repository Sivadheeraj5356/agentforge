"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Input, Label, Textarea } from "@agentforge/ui";

import {
  createEvaluationReviewAction,
  type ReviewActionResult,
} from "@/modules/reviews/actions";

const initial: ReviewActionResult | undefined = undefined;

export function OpenReviewForm({
  organizationSlug,
  evaluationRunId,
}: {
  organizationSlug: string;
  evaluationRunId: string;
}): ReactElement {
  const [state, action, pending] = useActionState(createEvaluationReviewAction, initial);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-3">
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      <input type="hidden" name="evaluationRunId" value={evaluationRunId} />
      <Label htmlFor="review-title">Finding title</Label>
      <Input id="review-title" name="title" required />
      <Label htmlFor="review-description">Evidence</Label>
      <Textarea id="review-description" name="description" required minLength={8} />
      {pending ? <p className="text-muted-foreground text-sm">Opening…</p> : null}
      {state && !state.ok ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? <p className="text-sm">{state.message}</p> : null}
      <Button type="submit" variant="outline">
        Open review finding
      </Button>
    </form>
  );
}
