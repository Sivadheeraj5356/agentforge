"use client";

import { useActionState, type ReactElement } from "react";
import { Button } from "@agentforge/ui";

import { enqueueSuiteAction, type LabActionResult } from "@/modules/lab/actions";
import { FormSelect } from "@/components/form-select";

const initial: LabActionResult | undefined = undefined;

export function EnqueueSuiteForm({
  organizationSlug,
  suites,
  projects,
}: {
  organizationSlug: string;
  suites: readonly { id: string; name: string }[];
  projects: readonly { slug: string; name: string }[];
}): ReactElement | null {
  const [state, action, pending] = useActionState(enqueueSuiteAction, initial);
  if (suites.length === 0 || projects.length === 0) {
    return null;
  }
  return (
    <form action={action} className="flex max-w-lg flex-col gap-3">
      <input type="hidden" name="organizationSlug" value={organizationSlug} />
      <FormSelect
        id="enqueue-suite"
        name="suiteId"
        label="Suite"
        required
        options={suites.map((suite) => ({ value: suite.id, label: suite.name }))}
      />
      <FormSelect
        id="enqueue-suite-project"
        name="projectSlug"
        label="Project"
        required
        options={projects.map((project) => ({ value: project.slug, label: project.name }))}
      />
      <FormSelect
        id="enqueue-suite-agent"
        name="agentKind"
        label="Harness"
        defaultValue="oracle"
        options={[
          { value: "oracle", label: "Oracle" },
          { value: "nop", label: "NOP" },
          { value: "agent", label: "Reference" },
          { value: "byo", label: "BYO (worker-configured)" },
        ]}
      />
      {pending ? <p className="text-muted-foreground text-sm">Queueing…</p> : null}
      {state && !state.ok ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      {state && state.ok ? <p className="text-sm">{state.message}</p> : null}
      <Button type="submit" variant="outline">
        Queue suite
      </Button>
    </form>
  );
}
