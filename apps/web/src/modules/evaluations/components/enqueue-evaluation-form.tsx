"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Input, Label } from "@agentforge/ui";

import {
  enqueueAblationAction,
  enqueueEvaluationAction,
  type ActionResult,
} from "@/modules/evaluations/actions";
import type { CatalogTaskOption } from "@/modules/evaluations/server/catalog";
import { FormSelect } from "@/components/form-select";

const initial: ActionResult | undefined = undefined;

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
          <FormSelect
            id="eval-project"
            name="projectSlug"
            label="Project"
            required
            options={projects.map((project) => ({ value: project.slug, label: project.name }))}
          />
          <FormSelect
            id="eval-task"
            name="catalogTaskKey"
            label="Catalog task"
            defaultValue={defaultTask?.taskKey}
            required
            options={tasks.map((task) => ({
              value: task.taskKey,
              label: `${task.benchmarkKey} / ${task.taskName}`,
            }))}
          />
          <FormSelect
            id="eval-recipe"
            name="rewardRecipe"
            label="Reward recipe"
            defaultValue="binary"
            options={[
              { value: "binary", label: "Binary" },
              { value: "continuous", label: "Continuous" },
              { value: "hybrid", label: "Hybrid" },
              { value: "staged", label: "Staged (work environments)" },
            ]}
          />
          <FormSelect
            id="eval-sandbox"
            name="sandboxProvider"
            label="Sandbox"
            defaultValue="isolated"
            options={[
              { value: "isolated", label: "Isolated (agent ≠ grader)" },
              { value: "work", label: "Work environment (MCP, evaluator)" },
              { value: "fake", label: "Fake (fixtures only, tests)" },
            ]}
          />
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
          <FormSelect
            id="ablation-project"
            name="projectSlug"
            label="Ablation project"
            required
            options={projects.map((project) => ({ value: project.slug, label: project.name }))}
          />
          <FormSelect
            id="ablation-task"
            name="catalogTaskKey"
            label="Ablation catalog task"
            defaultValue={defaultTask?.taskKey}
            required
            options={tasks.map((task) => ({
              value: task.taskKey,
              label: `${task.benchmarkKey} / ${task.taskName}`,
            }))}
          />
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
