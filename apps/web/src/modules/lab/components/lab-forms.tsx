"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Input, Label, Textarea } from "@agentforge/ui";

import {
  createDatasetVersionAction,
  createEnvironmentVersionAction,
  createScenarioAction,
  type LabActionResult,
} from "@/modules/lab/actions";

const initial: LabActionResult | undefined = undefined;

export function LabForms({
  organizationSlug,
  projects,
}: {
  organizationSlug: string;
  projects: readonly { slug: string; name: string }[];
}): ReactElement {
  const [scenarioState, scenarioAction] = useActionState(createScenarioAction, initial);
  const [datasetState, datasetAction] = useActionState(createDatasetVersionAction, initial);
  const [envState, envAction] = useActionState(createEnvironmentVersionAction, initial);

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <form action={scenarioAction} className="flex flex-col gap-3">
        <h2 className="font-serif text-lg tracking-tight">Private scenario</h2>
        <input type="hidden" name="organizationSlug" value={organizationSlug} />
        <Label htmlFor="scenario-project">Project</Label>
        <select
          id="scenario-project"
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
        <Label htmlFor="scenario-key">Key</Label>
        <Input id="scenario-key" name="key" required />
        <Label htmlFor="scenario-name">Name</Label>
        <Input id="scenario-name" name="name" required />
        <Label htmlFor="scenario-request">Request</Label>
        <Textarea id="scenario-request" name="requestText" required />
        <Label htmlFor="scenario-source">Authoring</Label>
        <select
          id="scenario-source"
          name="authoringSource"
          className="border-border bg-surface h-(--height-control) rounded-md border px-3 text-sm"
        >
          <option value="human">Human</option>
          <option value="ai_assisted">AI-assisted (never auto-trusted)</option>
        </select>
        <input type="hidden" name="difficulty" value="medium" />
        {scenarioState && !scenarioState.ok ? (
          <p role="alert" className="text-danger text-sm">
            {scenarioState.error}
          </p>
        ) : null}
        {scenarioState && scenarioState.ok ? (
          <p className="text-sm">{scenarioState.message}</p>
        ) : null}
        <Button type="submit">Save scenario</Button>
      </form>

      <form action={envAction} className="flex flex-col gap-3">
        <h2 className="font-serif text-lg tracking-tight">Environment version</h2>
        <input type="hidden" name="organizationSlug" value={organizationSlug} />
        <Label htmlFor="env-adapter">Adapter</Label>
        <select
          id="env-adapter"
          name="adapterId"
          className="border-border bg-surface h-(--height-control) rounded-md border px-3 text-sm"
        >
          <option value="isolated">isolated</option>
          <option value="unsupported">unsupported (refuses Gmail/Slack)</option>
          <option value="work">work (evaluator MCP worlds)</option>
        </select>
        <Label htmlFor="env-version">Version</Label>
        <Input id="env-version" name="version" required placeholder="1.0.0" />
        {envState && !envState.ok ? (
          <p role="alert" className="text-danger text-sm">
            {envState.error}
          </p>
        ) : null}
        {envState && envState.ok ? <p className="text-sm">{envState.message}</p> : null}
        <Button type="submit">Pin environment</Button>
      </form>

      <form action={datasetAction} className="flex flex-col gap-3">
        <h2 className="font-serif text-lg tracking-tight">Dataset version</h2>
        <input type="hidden" name="organizationSlug" value={organizationSlug} />
        <Label htmlFor="dataset-name">Name</Label>
        <Input id="dataset-name" name="name" required />
        <Label htmlFor="dataset-version">Version</Label>
        <Input id="dataset-version" name="version" required placeholder="1.0.0" />
        {datasetState && !datasetState.ok ? (
          <p role="alert" className="text-danger text-sm">
            {datasetState.error}
          </p>
        ) : null}
        {datasetState && datasetState.ok ? <p className="text-sm">{datasetState.message}</p> : null}
        <Button type="submit">Create PRIVATE dataset</Button>
      </form>
    </div>
  );
}
