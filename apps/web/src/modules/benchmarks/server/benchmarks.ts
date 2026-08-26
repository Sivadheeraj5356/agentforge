import type { Database } from "@agentforge/contracts";
import { CatalogKeySchema } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export type Benchmark = Database["public"]["Tables"]["benchmarks"]["Row"];
export type BenchmarkVersion = Database["public"]["Tables"]["benchmark_versions"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskVersion = Database["public"]["Tables"]["task_versions"]["Row"];

export async function listBenchmarks(): Promise<Benchmark[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("benchmarks")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Unable to load benchmarks.");
  }
  return data ?? [];
}

export async function getBenchmarkByKey(rawKey: string): Promise<Benchmark | null> {
  await requireAuthenticatedUser();
  const parsed = CatalogKeySchema.safeParse(rawKey);
  if (!parsed.success) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("benchmarks")
    .select("*")
    .eq("key", parsed.data)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load benchmark.");
  }
  return data;
}

export async function listBenchmarkVersions(benchmarkId: string): Promise<BenchmarkVersion[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("benchmark_versions")
    .select("*")
    .eq("benchmark_id", benchmarkId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load benchmark versions.");
  }
  return data ?? [];
}

export async function listTasksForBenchmarkVersion(benchmarkVersionId: string): Promise<Task[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("benchmark_version_id", benchmarkVersionId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Unable to load tasks.");
  }
  return data ?? [];
}

export async function listTaskVersions(taskId: string): Promise<TaskVersion[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("task_versions")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load task versions.");
  }
  return data ?? [];
}
