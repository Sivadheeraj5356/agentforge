import { NextResponse } from "next/server";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { isApiError, requireApiSession } from "@/modules/api/v1/session";
import { stageScoresFromMetrics } from "@/modules/environments/server/packs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  assertNeverExecutesUserCode("api v1 rollout get");
  const session = await requireApiSession(request);
  if (isApiError(session)) {
    return session;
  }
  const { id } = await context.params;
  const { data: rollout, error } = await session.supabase
    .from("rollouts")
    .select("id, seed, reward, environment_version_id, evaluation_run_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !rollout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let stages: Record<string, number> = {};
  if (rollout.evaluation_run_id) {
    const { data: trial } = await session.supabase
      .from("evaluation_trials")
      .select("metrics, reward")
      .eq("evaluation_run_id", rollout.evaluation_run_id)
      .order("attempt_index", { ascending: true })
      .limit(1)
      .maybeSingle();
    stages = stageScoresFromMetrics(trial?.metrics ?? null);
  }
  return NextResponse.json({
    id: rollout.id,
    seed: rollout.seed,
    reward: rollout.reward,
    environmentVersionId: rollout.environment_version_id,
    evaluationRunId: rollout.evaluation_run_id,
    stages,
  });
}
