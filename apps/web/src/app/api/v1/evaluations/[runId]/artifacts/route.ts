import { NextResponse } from "next/server";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { isApiError, requireApiSession } from "@/modules/api/v1/session";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  assertNeverExecutesUserCode("api v1 evaluation artifacts");
  const session = await requireApiSession(request);
  if (isApiError(session)) {
    return session;
  }
  const { runId } = await context.params;
  const { data: trials } = await session.supabase
    .from("evaluation_trials")
    .select("trajectory_artifact_id, log_artifact_id")
    .eq("evaluation_run_id", runId);
  const ids = (trials ?? [])
    .flatMap((trial) => [trial.trajectory_artifact_id, trial.log_artifact_id])
    .filter((id): id is string => typeof id === "string");
  if (ids.length === 0) {
    return NextResponse.json({ artifacts: [] });
  }
  const { data, error } = await session.supabase.from("artifacts").select("*").in("id", ids);
  if (error) {
    return NextResponse.json({ error: "Unable to load artifacts" }, { status: 400 });
  }
  return NextResponse.json({ artifacts: data ?? [] });
}
