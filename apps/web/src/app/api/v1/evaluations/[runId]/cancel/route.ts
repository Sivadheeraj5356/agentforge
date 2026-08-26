import { NextResponse } from "next/server";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { isApiError, requireApiSession } from "@/modules/api/v1/session";

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  assertNeverExecutesUserCode("api v1 cancel evaluation");
  const session = await requireApiSession(request);
  if (isApiError(session)) {
    return session;
  }
  const { runId } = await context.params;
  const { data, error } = await session.supabase.rpc("cancel_evaluation_run", {
    p_run_id: runId,
  });
  if (error || !data) {
    return NextResponse.json({ error: "Unable to cancel evaluation" }, { status: 400 });
  }
  return NextResponse.json({ evaluation: data });
}
