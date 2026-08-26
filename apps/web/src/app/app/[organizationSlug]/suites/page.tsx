import type { ReactElement } from "react";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { DomainEmptyState } from "@/components/domain-empty-state";
import { listPublishedCatalogTasks } from "@/modules/evaluations/server/catalog";
import { CreateSuiteForm } from "@/modules/lab/components/create-suite-form";
import { EnqueueSuiteForm } from "@/modules/lab/components/enqueue-suite-form";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import { canManageProjects } from "@/modules/projects/permissions";
import { listRecentProjects } from "@/modules/projects/server/projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SuitesPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web suites");
  const { organizationSlug } = await params;
  const organization = await requireOrganizationBySlug(organizationSlug);
  const canManage = canManageProjects(organization.role);
  const tasks = await listPublishedCatalogTasks();
  const projects = await listRecentProjects(organization.id, 50);
  const supabase = await createSupabaseServerClient();
  const { data: suites } = await supabase
    .from("evaluation_suites")
    .select("id, name, created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <h1 className="font-serif text-2xl tracking-tight">Suites</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Pinned task version lists with machine-readable gates. GitHub App checks are last, behind
          an adapter that is not configured.
        </p>
      </header>
      {canManage ? <CreateSuiteForm organizationSlug={organization.slug} tasks={tasks} /> : null}
      {canManage ? (
        <EnqueueSuiteForm
          organizationSlug={organization.slug}
          suites={(suites ?? []).map((suite) => ({ id: suite.id, name: suite.name }))}
          projects={projects.map((project) => ({ slug: project.slug, name: project.name }))}
        />
      ) : null}
      {(suites ?? []).length === 0 ? (
        <DomainEmptyState
          title="No suites yet"
          description="Create a suite that pins task versions and fails if pass@1 drops below a threshold."
        />
      ) : (
        <ul className="border-border divide-y">
          {(suites ?? []).map((suite) => (
            <li key={suite.id} className="py-3 text-sm">
              {suite.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
