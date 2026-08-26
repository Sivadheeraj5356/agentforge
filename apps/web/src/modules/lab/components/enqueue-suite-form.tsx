"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Label } from "@agentforge/ui";

import { enqueueSuiteAction, type LabActionResult } from "@/modules/lab/actions";

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
      <Label htmlFor="enqueue-suite">Suite</Label>
      <select
        id="enqueue-suite"
        name="suiteId"
        className="border-border bg-surface h-(--height-control) rounded-md border px-3 text-sm"
        required
      >
        {suites.map((suite) => (
          <option key={suite.id} value={suite.id}>
            {suite.name}
          </option>
        ))}
      </select>
      <Label htmlFor="enqueue-suite-project">Project</Label>
      <select
        id="enqueue-suite-project"
        name="projectSlug"
        className="border-border bg-surface h-(--height-control) rounded-md border px-3 text-sm"
        required
      >
        {projects.map((project) => (
          <option key={project.slug} value={project.slug}>
            {project.name}
          </option>
        ))}
      </select>
      <Label htmlFor="enqueue-suite-agent">Harness</Label>
      <select
        id="enqueue-suite-agent"
        name="agentKind"
        className="border-border bg-surface h-(--height-control) rounded-md border px-3 text-sm"
        defaultValue="oracle"
      >
        <option value="oracle">Oracle</option>
        <option value="nop">NOP</option>
        <option value="agent">Reference</option>
        <option value="byo">BYO (worker-configured)</option>
      </select>
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
