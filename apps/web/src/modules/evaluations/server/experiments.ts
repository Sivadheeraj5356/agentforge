import type { Database, Json } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import { listPublishedCatalogTasks } from "@/modules/evaluations/server/catalog";
import { splitTaskKeys } from "@/modules/evaluations/server/split";

export type TrainingExperiment = Database["public"]["Tables"]["training_experiments"]["Row"];
export type TrainingExperimentTask =
  Database["public"]["Tables"]["training_experiment_tasks"]["Row"];

export async function listTrainingExperiments(
  organizationId: string,
): Promise<TrainingExperiment[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("training_experiments")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load training experiments.");
  }
  return data ?? [];
}

export async function createPlannedExperiment(input: {
  organizationId: string;
  projectId: string | null;
  name: string;
  stage: "base" | "sft" | "grpo" | "ablation";
  rewardRecipe: "binary" | "continuous" | "hybrid";
  splitSeed: number;
  heldOutCount: number;
  notes?: string;
}): Promise<TrainingExperiment> {
  const user = await requireAuthenticatedUser();
  const catalog = await listPublishedCatalogTasks();
  const keys = catalog.map((task) => task.taskKey);
  const split = splitTaskKeys(keys, input.splitSeed, input.heldOutCount);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("training_experiments")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      name: input.name,
      stage: input.stage,
      reward_recipe: input.rewardRecipe,
      split_seed: input.splitSeed,
      train_task_count: split.train.length,
      held_out_task_count: split.heldOut.length,
      status: "planned",
      metrics: {} as Json,
      notes:
        input.notes ?? "Dry-run record. Metrics stay empty until a real training job writes them.",
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Unable to create training experiment.");
  }

  const keyToVersion = new Map(catalog.map((task) => [task.taskKey, task.taskVersionId]));
  const rows = [
    ...split.train.map((key) => ({
      experiment_id: data.id,
      task_version_id: keyToVersion.get(key) ?? "",
      split: "train" as const,
    })),
    ...split.heldOut.map((key) => ({
      experiment_id: data.id,
      task_version_id: keyToVersion.get(key) ?? "",
      split: "held_out" as const,
    })),
  ].filter((row) => row.task_version_id.length > 0);

  if (rows.length > 0) {
    const { error: splitError } = await supabase.from("training_experiment_tasks").insert(rows);
    if (splitError) {
      throw new Error("Unable to record the train/held-out split.");
    }
  }

  return data;
}
