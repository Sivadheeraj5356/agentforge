import { NextResponse } from "next/server";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { isApiError, requireApiSession } from "@/modules/api/v1/session";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  assertNeverExecutesUserCode("api v1 evaluation trajectory");
  const session = await requireApiSession(request);
  if (isApiError(session)) {
    return session;
  }
  const { runId } = await context.params;
  const { data, error } = await session.supabase
    .from("evaluation_trials")
    .select("id, attempt_index, metrics, reward, failure_category")
    .eq("evaluation_run_id", runId)
    .order("attempt_index", { ascending: true });
  if (error) {
    return NextResponse.json({ error: "Unable to load trajectory" }, { status: 400 });
  }
  return NextResponse.json({ trials: data ?? [] });
}
