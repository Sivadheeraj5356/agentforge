"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Input, Label } from "@agentforge/ui";

import { createExperimentAction, type ActionResult } from "@/modules/evaluations/actions";

const initial: ActionResult | undefined = undefined;
const selectClassName =
  "border-border bg-surface text-foreground h-(--height-control) w-full rounded-md border px-3 text-sm";

export function PlanExperimentForm({
  organizationSlug,
  projects,
}: {
  organizationSlug: string;
  projects: readonly { slug: string; name: string }[];
}): ReactElement {
  const [state, formAction, pending] = useActionState(createExperimentAction, initial);

  if (projects.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Create a project before recording a training experiment.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="exp-name">Name</Label>
          <Input id="exp-name" name="name" required maxLength={120} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="exp-project">Project</Label>
          <select id="exp-project" name="projectSlug" className={selectClassName} required>
            {projects.map((project) => (
              <option key={project.slug} value={project.slug}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="exp-stage">Stage</Label>
          <select id="exp-stage" name="stage" className={selectClassName} defaultValue="sft">
            <option value="base">Base</option>
            <option value="sft">SFT</option>
            <option value="grpo">GRPO</option>
            <option value="ablation">Ablation</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="exp-recipe">Reward recipe</Label>
          <select
            id="exp-recipe"
            name="rewardRecipe"
            className={selectClassName}
            defaultValue="binary"
          >
            <option value="binary">Binary</option>
            <option value="continuous">Continuous</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="exp-heldout">Held-out tasks</Label>
          <Input
            id="exp-heldout"
            name="heldOutCount"
            type="number"
            min={1}
            max={7}
            defaultValue={2}
          />
        </div>
        <input type="hidden" name="splitSeed" value="1" />
      </div>
      {pending ? (
        <p role="status" className="text-muted-foreground text-sm">
          Recording…
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
      <Button type="submit">Record planned experiment</Button>
    </form>
  );
}
