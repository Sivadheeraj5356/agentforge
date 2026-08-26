import type { Database } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import { listEvaluationRunsForOrganization } from "@/modules/evaluations/server/evaluation-runs";

export type EvaluationResult = Database["public"]["Tables"]["evaluation_results"]["Row"];

export async function listEvaluationResultsForOrganization(
  organizationId: string,
): Promise<EvaluationResult[]> {
  await requireAuthenticatedUser();
  const runs = await listEvaluationRunsForOrganization(organizationId);
  if (runs.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluation_results")
    .select("*")
    .in(
      "evaluation_run_id",
      runs.map((run) => run.id),
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load evaluation results.");
  }
  return data ?? [];
}
