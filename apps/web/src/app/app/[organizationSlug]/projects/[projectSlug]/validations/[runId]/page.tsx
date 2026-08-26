import type { ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { requireProjectBySlug } from "@/modules/projects/server/projects";
import {
  parseSeverityFilter,
  ValidationFindingsReport,
} from "@/modules/validation/components/validation-findings";
import {
  getValidationFindings,
  getValidationRun,
} from "@/modules/validation/server/validation-runs";

export default async function ValidationRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string; projectSlug: string; runId: string }>;
  searchParams: Promise<{ severity?: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web validation run");
  const [{ organizationSlug, projectSlug, runId }, { severity }] = await Promise.all([
    params,
    searchParams,
  ]);
  const { organization, project } = await requireProjectBySlug(organizationSlug, projectSlug);
  const run = await getValidationRun(project.id, runId);
  if (!run) {
    notFound();
  }
  const findings = await getValidationFindings(run.id);
  const basePath = `/app/${organization.slug}/projects/${project.slug}/validations/${run.id}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-3 border-b pb-6">
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]">
          <Link
            href={`/app/${organization.slug}/projects/${project.slug}`}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            {project.slug}
          </Link>
          <span aria-hidden="true">/</span>
          <span>validation</span>
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Validation report</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Static findings only. Every claim below comes from inspecting files in the uploaded
          package. Nothing in the package was built, installed, or executed.
        </p>
      </header>
      <ValidationFindingsReport
        run={run}
        findings={findings}
        basePath={basePath}
        severityFilter={parseSeverityFilter(severity)}
      />
    </div>
  );
}
