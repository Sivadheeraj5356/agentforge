"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Input, Label } from "@agentforge/ui";

import { createSuiteAction, type LabActionResult } from "@/modules/lab/actions";
import { FormSelect } from "@/components/form-select";
import type { CatalogTaskOption } from "@/modules/evaluations/server/catalog";

const initial: LabActionResult | undefined = undefined;

export function CreateSuiteForm({
  organizationSlug,
  tasks,
}: {
  organizationSlug: string;
  tasks: readonly CatalogTaskOption[];
}): ReactElement {
  const [state, action, pending] = useActionState(createSuiteAction, initial);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-3">
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="suite-name">Suite name</Label>
        <Input id="suite-name" name="name" required />
      </div>
      <FormSelect
        id="suite-task"
        name="catalogTaskKey"
        label="Pinned task version"
        required
        options={tasks.map((task) => ({
          value: task.taskKey,
          label: `${task.taskKey} @${task.taskVersion}`,
        }))}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="suite-gate">Fail if pass@1 &lt;</Label>
        <Input
          id="suite-gate"
          name="minPassAt1"
          type="number"
          min={0}
          max={1}
          step="0.01"
          defaultValue="1"
        />
      </div>
      {pending ? <p className="text-muted-foreground text-sm">Saving…</p> : null}
      {state && !state.ok ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? <p className="text-sm">{state.message}</p> : null}
      <Button type="submit">Create suite</Button>
    </form>
  );
}
