import type { ReactElement } from "react";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { DomainEmptyState } from "@/components/domain-empty-state";
import { listBenchmarks } from "@/modules/benchmarks/server/benchmarks";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";

export default async function BenchmarksPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web benchmarks");
  const { organizationSlug } = await params;
  await requireOrganizationBySlug(organizationSlug);

  let benchmarks: Awaited<ReturnType<typeof listBenchmarks>> = [];
  let loadError: string | undefined;
  try {
    benchmarks = await listBenchmarks();
  } catch {
    loadError = "Unable to load benchmarks.";
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <h1 className="font-serif text-2xl tracking-tight">Benchmarks</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Catalog of evaluation suites. Runs pin a specific version. Terminus structural validation
          maps packages through an adapter; Harbor execution lives in the evaluator worker.
        </p>
      </header>

      {loadError ? (
        <p role="alert" className="text-danger text-sm">
          {loadError}
        </p>
      ) : null}

      {benchmarks.length === 0 ? (
        <DomainEmptyState
          title="No benchmarks yet"
          description="The catalog is empty. Publishing a suite and pinning a version comes after this foundation."
        />
      ) : (
        <ul className="border-border divide-border divide-y border-y">
          {benchmarks.map((benchmark) => (
            <li key={benchmark.id} className="flex flex-col gap-1 px-1 py-3">
              <span className="font-medium tracking-tight">{benchmark.name}</span>
              <span className="text-muted-foreground font-mono text-xs">{benchmark.key}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
