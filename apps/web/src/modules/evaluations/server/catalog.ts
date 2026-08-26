import {
  harnessCatalogLookup,
  type Database,
  type EvaluationAgentKind,
} from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import {
  listBenchmarkVersions,
  listBenchmarks,
  listTasksForBenchmarkVersion,
  listTaskVersions,
} from "@/modules/benchmarks/server/benchmarks";

export type CatalogTaskOption = {
  readonly taskVersionId: string;
  readonly taskVersion: string;
  readonly taskKey: string;
  readonly taskName: string;
  readonly taskDescription: string | null;
  readonly benchmarkKey: string;
  readonly benchmarkName: string;
  readonly benchmarkVersion: string;
  readonly benchmarkVersionId: string;
};

export type CatalogAgent = Pick<
  Database["public"]["Tables"]["agents"]["Row"],
  "id" | "provider" | "name" | "version" | "type"
>;

export async function listPublishedCatalogTasks(): Promise<CatalogTaskOption[]> {
  await requireAuthenticatedUser();
  const benchmarks = await listBenchmarks();
  const options: CatalogTaskOption[] = [];
  for (const benchmark of benchmarks) {
    if (benchmark.status !== "published") {
      continue;
    }
    const versions = await listBenchmarkVersions(benchmark.id);
    for (const version of versions) {
      const tasks = await listTasksForBenchmarkVersion(version.id);
      for (const task of tasks) {
        const taskVersions = await listTaskVersions(task.id);
        const latest = taskVersions[0];
        if (!latest) {
          continue;
        }
        options.push({
          taskVersionId: latest.id,
          taskVersion: latest.version,
          taskKey: task.external_key,
          taskName: task.name,
          taskDescription: task.description,
          benchmarkKey: benchmark.key,
          benchmarkName: benchmark.name,
          benchmarkVersion: version.version,
          benchmarkVersionId: version.id,
        });
      }
    }
  }
  return options.sort((left, right) => left.taskKey.localeCompare(right.taskKey));
}

export async function getCatalogTaskByKey(taskKey: string): Promise<CatalogTaskOption | null> {
  const tasks = await listPublishedCatalogTasks();
  return tasks.find((task) => task.taskKey === taskKey) ?? null;
}

export async function getHarnessAgent(kind: EvaluationAgentKind): Promise<CatalogAgent> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const lookup = harnessCatalogLookup(kind);
  const { data, error } = await supabase
    .from("agents")
    .select("id, provider, name, version, type")
    .eq("provider", lookup.provider)
    .eq("name", lookup.name)
    .eq("version", "1.0.0")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Harness agent is not in the catalog.");
  }
  return data;
}
