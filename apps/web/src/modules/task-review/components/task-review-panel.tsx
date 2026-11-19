"use client";

import { useActionState, type ReactElement } from "react";
import { Button, cn } from "@agentforge/ui";

import {
  requestTaskReviewAction,
  type TaskReviewActionResult,
} from "@/modules/task-review/actions";

const initial: TaskReviewActionResult | undefined = undefined;

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "border-success/30 bg-success/10 text-success",
  medium: "border-warning/30 bg-warning/10 text-warning",
  hard: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  expert: "border-danger/30 bg-danger/10 text-danger",
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
    <div className="flex flex-col gap-2">
      <h4 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
        {title}
      </h4>
      <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed">
        {items.map((item) => (
          <li key={item} className="marker:text-muted-foreground">
            {item}
          </li>
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
    <section className="border-border bg-surface overflow-hidden rounded-lg border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex max-w-2xl flex-col gap-1">
          <h3 className="text-base font-semibold tracking-tight">AI task review</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Sends the task instruction, file list, and validation findings to an agent for a quality
            review, difficulty rating, and readiness assessment. Nothing executes.
          </p>
        </div>
        <form action={formAction} className="shrink-0">
          <input type="hidden" name="organizationSlug" value={organizationSlug} />
          <input type="hidden" name="projectSlug" value={projectSlug} />
          <input type="hidden" name="taskSlug" value={taskSlug} />
          <input type="hidden" name="runNumber" value={runNumber} />
          <Button type="submit" disabled={pending}>
            {pending ? "Reviewing..." : "Run agent review"}
          </Button>
        </form>
      </div>

      {state?.ok === false ? <p className="text-danger px-5 py-4 text-sm">{state.error}</p> : null}

      {state?.ok === true ? (
        <div className="flex flex-col gap-5 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                DIFFICULTY_STYLES[state.review.difficulty] ??
                  "border-border bg-muted text-muted-foreground",
              )}
            >
              {state.review.difficulty}
            </span>
            <span className="text-muted-foreground text-xs">
              Reviewed by the agent review chain
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-sm leading-relaxed">{state.review.summary}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {state.review.difficultyRationale}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <ReviewList title="Strengths" items={state.review.strengths} />
            <ReviewList title="Issues" items={state.review.issues} />
            <ReviewList title="Suggestions" items={state.review.suggestions} />
          </div>

          <div
            className={cn(
              "flex flex-col gap-2 rounded-md border px-4 py-3",
              state.review.readiness.ready
                ? "border-success/30 bg-success/5"
                : "border-danger/30 bg-danger/5",
            )}
          >
            <h4
              className={cn(
                "text-sm font-semibold",
                state.review.readiness.ready ? "text-success" : "text-danger",
              )}
            >
              {state.review.readiness.ready
                ? "Ready for benchmark use"
                : "Not ready for benchmark use"}
            </h4>
            <ReviewList title="Missing" items={state.review.readiness.missing} />
            <p className="text-muted-foreground text-sm leading-relaxed">
              {state.review.readiness.assessment}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
