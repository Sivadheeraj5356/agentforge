"use client";

import { useActionState, type ReactElement } from "react";
import { Button, Input, Label, Textarea } from "@agentforge/ui";

import {
  createDatasetVersionAction,
  createEnvironmentVersionAction,
  createScenarioAction,
  type LabActionResult,
} from "@/modules/lab/actions";
import { FormSelect } from "@/components/form-select";

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
        <h2 className="text-lg font-semibold tracking-tight">Private scenario</h2>
        <input type="hidden" name="organizationSlug" value={organizationSlug} />
        <FormSelect
          id="scenario-project"
          name="projectSlug"
          label="Project"
          required
          options={projects.map((project) => ({ value: project.slug, label: project.name }))}
        />
        <Label htmlFor="scenario-key">Key</Label>
        <Input id="scenario-key" name="key" required />
        <Label htmlFor="scenario-name">Name</Label>
        <Input id="scenario-name" name="name" required />
        <Label htmlFor="scenario-request">Request</Label>
        <Textarea id="scenario-request" name="requestText" required />
        <FormSelect
          id="scenario-source"
          name="authoringSource"
          label="Authoring"
          options={[
            { value: "human", label: "Human" },
            { value: "ai_assisted", label: "AI-assisted (never auto-trusted)" },
          ]}
        />
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
        <h2 className="text-lg font-semibold tracking-tight">Environment version</h2>
        <input type="hidden" name="organizationSlug" value={organizationSlug} />
        <FormSelect
          id="env-adapter"
          name="adapterId"
          label="Adapter"
          options={[
            { value: "isolated", label: "isolated" },
            { value: "unsupported", label: "unsupported (refuses Gmail/Slack)" },
            { value: "work", label: "work (evaluator MCP worlds)" },
          ]}
        />
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
        <h2 className="text-lg font-semibold tracking-tight">Dataset version</h2>
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
