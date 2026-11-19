"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Input, Label } from "@agentforge/ui";

import { createExperimentAction, type ActionResult } from "@/modules/evaluations/actions";
import { FormSelect } from "@/components/form-select";

const initial: ActionResult | undefined = undefined;

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
        <FormSelect
          id="exp-project"
          name="projectSlug"
          label="Project"
          required
          options={projects.map((project) => ({ value: project.slug, label: project.name }))}
        />
        <FormSelect
          id="exp-stage"
          name="stage"
          label="Stage"
          defaultValue="sft"
          options={[
            { value: "base", label: "Base" },
            { value: "sft", label: "SFT" },
            { value: "grpo", label: "GRPO" },
            { value: "ablation", label: "Ablation" },
          ]}
        />
        <FormSelect
          id="exp-recipe"
          name="rewardRecipe"
          label="Reward recipe"
          defaultValue="binary"
          options={[
            { value: "binary", label: "Binary" },
            { value: "continuous", label: "Continuous" },
            { value: "hybrid", label: "Hybrid" },
          ]}
        />
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
