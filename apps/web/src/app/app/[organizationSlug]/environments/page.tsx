import type { ReactElement } from "react";
import Link from "next/link";
import { EXPERIENCE_PACK_CATALOG, recoveryPackVariants, type Json } from "@agentforge/contracts";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { DomainEmptyState } from "@/components/domain-empty-state";
import { WorkspaceShortcutLinks } from "@/components/workspace-shortcuts";
import {
  EnvironmentPackForm,
  PackStageList,
  SimulatedBadges,
} from "@/modules/environments/components/environment-pack-form";
import {
  groupFailureCategories,
  stageScoresFromMetrics,
} from "@/modules/environments/server/packs";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import { canManageProjects } from "@/modules/projects/permissions";
import { listRecentProjects } from "@/modules/projects/server/projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EnvironmentsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web environments");
  const { organizationSlug } = await params;
  const organization = await requireOrganizationBySlug(organizationSlug);
  const canManage = canManageProjects(organization.role);
  const projects = await listRecentProjects(organization.id, 50);
  const supabase = await createSupabaseServerClient();
  const [{ data: environments }, { data: rollouts }, { data: trials }] = await Promise.all([
    supabase
      .from("environment_versions")
      .select("id, adapter_id, version, spec")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("rollouts")
      .select("id, seed, reward, environment_version_id, evaluation_run_id")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("evaluation_trials")
      .select("failure_category, metrics, evaluation_run_id")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const categories = groupFailureCategories(trials ?? []);
  const latestEnv = environments?.[0] ?? null;
  const firstPack = EXPERIENCE_PACK_CATALOG[0];
  const recoveryQueue = firstPack ? recoveryPackVariants(firstPack) : [];

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <h1 className="font-serif text-2xl tracking-tight">Environments</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Private Agent Work Environments — executable packs with hidden stage verifiers. Simulated
          Slack, GitHub, Jira, and Grafana stay labeled simulated. Scores come from the evaluator
          worker, not this page.
        </p>
        <WorkspaceShortcutLinks organizationSlug={organization.slug} ids={["lab"]} />
      </header>

      {canManage ? (
        <EnvironmentPackForm
          organizationSlug={organization.slug}
          projects={projects.map((project) => ({ slug: project.slug, name: project.name }))}
          environmentVersionId={latestEnv?.id ?? null}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          Owner or admin role required to start packs.
        </p>
      )}

      <section className="grid gap-8 lg:grid-cols-2">
        {EXPERIENCE_PACK_CATALOG.map((pack) => (
          <article key={pack.key} className="border-border flex flex-col gap-3 border-t pt-4">
            <h2 className="font-serif text-lg tracking-tight">{pack.title}</h2>
            <p className="text-sm leading-relaxed">{pack.instruction}</p>
            <SimulatedBadges pack={pack} />
            <h3 className="font-mono text-[11px] uppercase tracking-[0.14em]">Stages</h3>
            <PackStageList pack={pack} />
          </article>
        ))}
      </section>

      <section>
        <h2 className="font-serif text-lg tracking-tight">Partial rewards</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Stage keys appear here after the worker writes <span className="font-mono">metrics</span>.
        </p>
        {(trials ?? []).length === 0 ? (
          <DomainEmptyState
            title="No staged scores yet"
            description="Queue a pack run. This list stays empty until evaluation_trials exist."
          />
        ) : (
          <ul className="mt-3 space-y-2 font-mono text-xs">
            {(trials ?? []).slice(0, 8).map((trial, index) => {
              const stages = stageScoresFromMetrics(trial.metrics as Json);
              const keys = Object.keys(stages);
              return (
                <li key={`${trial.evaluation_run_id}-${index}`}>
                  {keys.length === 0
                    ? "waiting for stage_* keys"
                    : keys.map((key) => `${key}=${stages[key]}`).join(" · ")}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-serif text-lg tracking-tight">Capability gap</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Counts from stored <span className="font-mono">failure_category</span> rows. No pie chart.
        </p>
        {categories.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">No failure categories yet.</p>
        ) : (
          <ul className="mt-2 text-sm">
            {categories.map((row) => (
              <li key={row.category}>
                <span className="font-mono">{row.category}</span> · {row.count}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm">
          Generate more experiences for recovery (queue of pack variants):
        </p>
        <ul className="text-muted-foreground mt-1 list-disc pl-5 text-sm">
          {recoveryQueue.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-lg tracking-tight">Export</h2>
        <p className="text-muted-foreground mt-1 text-sm">PRIVATE JSONL from real rollouts.</p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          <li>
            <Link href="/api/v1/rollouts" className="underline underline-offset-4">
              All rollouts
            </Link>
          </li>
          <li>
            <Link href="/api/v1/rollouts?kind=successful" className="underline underline-offset-4">
              Successful trajectories
            </Link>
          </li>
          <li>
            <Link href="/api/v1/rollouts?kind=failed" className="underline underline-offset-4">
              Failed trajectories
            </Link>
          </li>
          <li>
            <Link href="/api/v1/rollouts?kind=recovery" className="underline underline-offset-4">
              Recovery trajectories
            </Link>
          </li>
          <li>
            <Link href="/api/v1/rollouts?kind=preference" className="underline underline-offset-4">
              Preference pairs
            </Link>
          </li>
        </ul>
        <p className="text-muted-foreground mt-4 text-sm">
          {(rollouts ?? []).length} recent rollouts · {(environments ?? []).length} environment
          versions
        </p>
      </section>
    </div>
  );
}
