"use client";

import { useActionState, type ReactElement } from "react";
import {
  EXPERIENCE_PACK_CATALOG,
  simulatedLabel,
  type ExperiencePack,
} from "@agentforge/contracts";
import { Button, Label } from "@agentforge/ui";

import {
  resetEnvironmentAction,
  startEnvironmentAction,
  type EnvironmentActionResult,
} from "@/modules/environments/actions";

const initial: EnvironmentActionResult | undefined = undefined;

const selectClassName =
  "border-border bg-surface text-foreground h-(--height-control) w-full rounded-md border px-3 text-sm";

export function EnvironmentPackForm({
  organizationSlug,
  projects,
  environmentVersionId,
}: {
  organizationSlug: string;
  projects: readonly { slug: string; name: string }[];
  environmentVersionId: string | null;
}): ReactElement {
  const [state, formAction, pending] = useActionState(startEnvironmentAction, initial);
  const [resetState, resetAction, resetPending] = useActionState(resetEnvironmentAction, initial);
  const defaultPack = EXPERIENCE_PACK_CATALOG[0];

  if (projects.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Create a project first. Pack runs pin a project, an immutable environment version, and a
        harness.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="organizationSlug" value={organizationSlug} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="env-project">Project</Label>
            <select id="env-project" name="projectSlug" className={selectClassName} required>
              {projects.map((project) => (
                <option key={project.slug} value={project.slug}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="env-pack">Experience pack</Label>
            <select
              id="env-pack"
              name="packKey"
              className={selectClassName}
              defaultValue={defaultPack?.key}
              required
            >
              {EXPERIENCE_PACK_CATALOG.map((pack) => (
                <option key={pack.key} value={pack.key}>
                  {pack.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        {pending ? (
          <p role="status" className="text-muted-foreground text-sm">
            Queueing pack run…
          </p>
        ) : null}
        {state && !state.ok ? (
          <p role="alert" className="text-danger text-sm">
            {state.error}
          </p>
        ) : null}
        {state && state.ok && state.message ? <p className="text-sm">{state.message}</p> : null}
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
        <p className="text-muted-foreground text-xs">
          Oracle and NOP do not need model keys. Reference and multi-agent need OPENAI_API_KEY or
          ANTHROPIC_API_KEY on the evaluator worker — missing keys fail the job instead of scoring
          like NOP. BYO is configured on the worker, not in this app.
        </p>
      </form>
      {environmentVersionId ? (
        <form action={resetAction} className="flex flex-col gap-3">
          <input type="hidden" name="organizationSlug" value={organizationSlug} />
          <input type="hidden" name="environmentVersionId" value={environmentVersionId} />
          <input type="hidden" name="agentKind" value="oracle" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="reset-project">Reset on project</Label>
            <select id="reset-project" name="projectSlug" className={selectClassName} required>
              {projects.map((project) => (
                <option key={`reset-${project.slug}`} value={project.slug}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          {resetPending ? (
            <p role="status" className="text-muted-foreground text-sm">
              Queueing reset…
            </p>
          ) : null}
          {resetState && !resetState.ok ? (
            <p role="alert" className="text-danger text-sm">
              {resetState.error}
            </p>
          ) : null}
          {resetState && resetState.ok && resetState.message ? (
            <p className="text-sm">{resetState.message}</p>
          ) : null}
          <Button type="submit" variant="outline">
            Reset environment
          </Button>
          <p className="text-muted-foreground text-xs">
            Reset enqueues a new job against the same immutable environment version.
          </p>
        </form>
      ) : null}
    </div>
  );
}

export function PackStageList({ pack }: { pack: ExperiencePack }): ReactElement {
  return (
    <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-sm">
      {pack.stages.map((stage) => (
        <li key={stage.id}>
          {stage.label} <span className="font-mono text-xs">({stage.weight.toFixed(2)})</span>
        </li>
      ))}
    </ol>
  );
}

export function SimulatedBadges({ pack }: { pack: ExperiencePack }): ReactElement {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {pack.simulated.map((backend) => (
        <li
          key={backend}
          className="border-border bg-muted/40 rounded-md border px-2 py-0.5 font-mono text-[11px]"
        >
          {simulatedLabel(backend)}
        </li>
      ))}
    </ul>
  );
}
