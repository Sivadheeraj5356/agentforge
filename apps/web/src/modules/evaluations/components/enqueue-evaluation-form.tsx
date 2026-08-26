"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Input, Label } from "@agentforge/ui";

import {
  enqueueAblationAction,
  enqueueEvaluationAction,
  type ActionResult,
} from "@/modules/evaluations/actions";
import type { CatalogTaskOption } from "@/modules/evaluations/server/catalog";

const initial: ActionResult | undefined = undefined;

const selectClassName =
  "border-border bg-surface text-foreground h-(--height-control) w-full rounded-md border px-3 text-sm";

export function EnqueueEvaluationForm({
  organizationSlug,
  projects,
  tasks,
}: {
  organizationSlug: string;
  projects: readonly { slug: string; name: string }[];
  tasks: readonly CatalogTaskOption[];
}): ReactElement {
  const [state, formAction, pending] = useActionState(enqueueEvaluationAction, initial);
  const [ablationState, ablationAction, ablationPending] = useActionState(
    enqueueAblationAction,
    initial,
  );
  const defaultTask = tasks.find((task) => task.taskKey === "broken-orders-api") ?? tasks[0];

  if (projects.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Create a project first. Evaluations pin a project, a catalog task version, and a harness.
      </p>
    );
  }

  if (tasks.length === 0) {
    return <p className="text-muted-foreground text-sm">The evaluation catalog is empty.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="organizationSlug" value={organizationSlug} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="eval-project">Project</Label>
            <select id="eval-project" name="projectSlug" className={selectClassName} required>
              {projects.map((project) => (
                <option key={project.slug} value={project.slug}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="eval-task">Catalog task</Label>
            <select
              id="eval-task"
              name="catalogTaskKey"
              className={selectClassName}
              defaultValue={defaultTask?.taskKey}
              required
            >
              {tasks.map((task) => (
                <option key={task.taskVersionId} value={task.taskKey}>
                  {task.benchmarkKey} / {task.taskName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="eval-recipe">Reward recipe</Label>
            <select
              id="eval-recipe"
              name="rewardRecipe"
              className={selectClassName}
              defaultValue="binary"
            >
              <option value="binary">Binary</option>
              <option value="continuous">Continuous</option>
              <option value="hybrid">Hybrid</option>
              <option value="staged">Staged (work environments)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="eval-sandbox">Sandbox</Label>
            <select
              id="eval-sandbox"
              name="sandboxProvider"
              className={selectClassName}
              defaultValue="isolated"
            >
              <option value="isolated">Isolated (agent ≠ grader)</option>
              <option value="work">Work environment (MCP, evaluator)</option>
              <option value="fake">Fake (fixtures only, tests)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="eval-attempts">Attempts (pass@k)</Label>
            <Input
              id="eval-attempts"
              name="attemptCount"
              type="number"
              min={1}
              max={8}
              defaultValue={3}
            />
          </div>
        </div>
        {pending ? (
          <p role="status" className="text-muted-foreground text-sm">
            Queueing…
          </p>
        ) : null}
        {state && !state.ok ? (
          <p role="alert" className="text-danger text-sm">
            {state.error}
          </p>
        ) : null}
        {state && state.ok && state.message ? (
          <p role="status" className="text-sm">
            {state.message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="agentKind" value="oracle">
            Run oracle
          </Button>
          <Button type="submit" name="agentKind" value="nop" variant="outline">
            Run NOP
          </Button>
          <Button type="submit" name="agentKind" value="agent" variant="outline">
            Run agent
          </Button>
          <Button type="submit" name="agentKind" value="multi_agent" variant="outline">
            Run multi-agent
          </Button>
          <Button type="submit" name="agentKind" value="byo" variant="outline">
            Run BYO
          </Button>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Next.js only stores the job id. Reference agents need OPENAI_API_KEY or ANTHROPIC_API_KEY
          on the evaluator. BYO is configured on the worker (AGENTFORGE_BYO_CMD or
          AGENTFORGE_BYO_HTTP_URL) — the control plane never receives the binary. Hidden tests stay
          off the agent filesystem. Fake is for catalog fixtures in tests, not untrusted uploads.
        </p>
      </form>
      <form action={ablationAction} className="flex flex-col gap-3">
        <input type="hidden" name="organizationSlug" value={organizationSlug} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ablation-project">Ablation project</Label>
            <select id="ablation-project" name="projectSlug" className={selectClassName} required>
              {projects.map((project) => (
                <option key={project.slug} value={project.slug}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ablation-task">Ablation catalog task</Label>
            <select
              id="ablation-task"
              name="catalogTaskKey"
              className={selectClassName}
              defaultValue={defaultTask?.taskKey}
              required
            >
              {tasks.map((task) => (
                <option key={`ablation-${task.taskVersionId}`} value={task.taskKey}>
                  {task.benchmarkKey} / {task.taskName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <input type="hidden" name="sandboxProvider" value="isolated" />
        <input type="hidden" name="attemptCount" value="1" />
        {ablationPending ? (
          <p role="status" className="text-muted-foreground text-sm">
            Queueing ablation…
          </p>
        ) : null}
        {ablationState && !ablationState.ok ? (
          <p role="alert" className="text-danger text-sm">
            {ablationState.error}
          </p>
        ) : null}
        {ablationState && ablationState.ok && ablationState.message ? (
          <p role="status" className="text-sm">
            {ablationState.message}
          </p>
        ) : null}
        <Button type="submit" variant="outline">
          Queue reward ablation
        </Button>
        <p className="text-muted-foreground text-xs">
          Enqueues oracle trials for binary, continuous, and hybrid on the selected catalog task.
          Scores appear only after the worker runs.
        </p>
      </form>
    </div>
  );
}
