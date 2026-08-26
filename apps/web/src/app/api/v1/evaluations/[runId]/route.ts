import { NextResponse } from "next/server";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { isApiError, requireApiSession } from "@/modules/api/v1/session";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  assertNeverExecutesUserCode("api v1 get evaluation");
  const session = await requireApiSession(request);
  if (isApiError(session)) {
    return session;
  }
  const { runId } = await context.params;
  const { data, error } = await session.supabase
    .from("evaluation_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Unable to load evaluation" }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ evaluation: data });
}
