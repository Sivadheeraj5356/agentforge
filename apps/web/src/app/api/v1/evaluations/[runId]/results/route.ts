import { NextResponse } from "next/server";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { isApiError, requireApiSession } from "@/modules/api/v1/session";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  assertNeverExecutesUserCode("api v1 evaluation results");
  const session = await requireApiSession(request);
  if (isApiError(session)) {
    return session;
  }
  const { runId } = await context.params;
  const { data: run } = await session.supabase
    .from("evaluation_runs")
    .select("id")
    .eq("id", runId)
    .maybeSingle();
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { data, error } = await session.supabase
    .from("evaluation_results")
    .select("*")
    .eq("evaluation_run_id", runId)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: "Unable to load results" }, { status: 400 });
  }
  return NextResponse.json({ results: data ?? [] });
}
