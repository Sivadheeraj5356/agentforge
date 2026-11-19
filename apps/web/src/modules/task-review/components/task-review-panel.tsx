"use client";

import { useActionState, type ReactElement } from "react";
import { Button } from "@agentforge/ui";

import {
  requestTaskReviewAction,
  type TaskReviewActionResult,
} from "@/modules/task-review/actions";

const initial: TaskReviewActionResult | undefined = undefined;

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  medium: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  hard: "border-orange-500/40 text-orange-600 dark:text-orange-400",
  expert: "border-red-500/40 text-red-600 dark:text-red-400",
};

function ReviewList({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}): ReactElement | null {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="text-muted-foreground list-disc pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function TaskReviewPanel({
  organizationSlug,
  projectSlug,
  taskSlug,
  runNumber,
}: {
  organizationSlug: string;
  projectSlug: string;
  taskSlug: string;
  runNumber: number;
}): ReactElement {
  const [state, formAction, pending] = useActionState(requestTaskReviewAction, initial);

  return (
    <section className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">AI task review</h3>
          <p className="text-muted-foreground text-sm">
            Sends the task instruction, file list, and validation findings to an agent for a quality
            review, difficulty rating, and readiness assessment. Nothing executes.
          </p>
        </div>
        <form action={formAction}>
          <input type="hidden" name="organizationSlug" value={organizationSlug} />
          <input type="hidden" name="projectSlug" value={projectSlug} />
          <input type="hidden" name="taskSlug" value={taskSlug} />
          <input type="hidden" name="runNumber" value={runNumber} />
          <Button type="submit" disabled={pending}>
            {pending ? "Reviewing..." : "Run agent review"}
          </Button>
        </form>
      </div>

      {state?.ok === false ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      {state?.ok === true ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-md border px-2 py-1 text-xs font-medium uppercase ${DIFFICULTY_STYLES[state.review.difficulty] ?? "border-border"}`}
            >
              {state.review.difficulty}
            </span>
            <span className="text-muted-foreground text-xs">
              Reviewed by the agent review chain
            </span>
          </div>
          <p className="text-sm">{state.review.summary}</p>
          <p className="text-muted-foreground text-sm">{state.review.difficultyRationale}</p>
          <ReviewList title="Strengths" items={state.review.strengths} />
          <ReviewList title="Issues" items={state.review.issues} />
          <ReviewList title="Suggestions" items={state.review.suggestions} />
          <div className="border-border flex flex-col gap-1 border-t pt-3">
            <h4 className="text-sm font-medium">
              {state.review.readiness.ready
                ? "Ready for benchmark use"
                : "Not ready for benchmark use"}
            </h4>
            <ReviewList title="Missing" items={state.review.readiness.missing} />
            <p className="text-muted-foreground text-sm">{state.review.readiness.assessment}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
