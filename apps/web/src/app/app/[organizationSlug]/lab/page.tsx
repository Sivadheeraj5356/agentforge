import type { ReactElement } from "react";
import Link from "next/link";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { LabForms } from "@/modules/lab/components/lab-forms";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import { canManageProjects } from "@/modules/projects/permissions";
import { listRecentProjects } from "@/modules/projects/server/projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LabPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web lab");
  const { organizationSlug } = await params;
  const organization = await requireOrganizationBySlug(organizationSlug);
  const canManage = canManageProjects(organization.role);
  const projects = await listRecentProjects(organization.id, 50);
  const supabase = await createSupabaseServerClient();
  const [{ data: scenarios }, { data: datasets }, { data: environments }, { data: rollouts }] =
    await Promise.all([
      supabase
        .from("eval_scenarios")
        .select("id, key, name, trusted, authoring_source")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("dataset_versions")
        .select("id, name, version, privacy_class")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("environment_versions")
        .select("id, adapter_id, version")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("rollouts")
        .select("id, seed, reward")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <h1 className="font-serif text-2xl tracking-tight">Lab</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Private scenarios, immutable environment versions, and PRIVATE dataset lineage. SSO, SAML,
          SCIM, and CMK are not implemented until a named customer needs them.
        </p>
      </header>
      {canManage ? (
        <LabForms
          organizationSlug={organization.slug}
          projects={projects.map((project) => ({ slug: project.slug, name: project.name }))}
        />
      ) : null}
      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="font-serif text-lg tracking-tight">Scenarios</h2>
          <ul className="mt-2 text-sm">
            {(scenarios ?? []).map((row) => (
              <li key={row.id}>
                {row.key} · {row.authoring_source} · {row.trusted ? "trusted" : "untrusted"}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-serif text-lg tracking-tight">Datasets</h2>
          <ul className="mt-2 text-sm">
            {(datasets ?? []).map((row) => (
              <li key={row.id}>
                {row.name} {row.version} · {row.privacy_class}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-serif text-lg tracking-tight">Environments</h2>
          <ul className="mt-2 text-sm">
            {(environments ?? []).map((row) => (
              <li key={row.id}>
                {row.adapter_id} {row.version}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-serif text-lg tracking-tight">Rollouts</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {(rollouts ?? []).length} recent ·{" "}
            <Link href={`/api/v1/rollouts`} className="underline underline-offset-4">
              JSONL export
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
