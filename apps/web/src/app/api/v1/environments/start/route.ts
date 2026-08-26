import { NextResponse } from "next/server";
import { StartEnvironmentInputSchema } from "@agentforge/contracts";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { isApiError, requireApiSession } from "@/modules/api/v1/session";
import { enqueuePackRun } from "@/modules/environments/server/packs";

export async function POST(request: Request): Promise<Response> {
  assertNeverExecutesUserCode("api v1 environments start");
  const session = await requireApiSession(request);
  if (isApiError(session)) {
    return session;
  }
  const body = await request.json().catch(() => null);
  const parsed = StartEnvironmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid environment start request" }, { status: 400 });
  }
  const { data: organization } = await session.supabase
    .from("organizations")
    .select("id, slug")
    .eq("slug", parsed.data.organizationSlug)
    .maybeSingle();
  if (!organization) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { data: project } = await session.supabase
    .from("projects")
    .select("id, slug, organization_id, status")
    .eq("organization_id", organization.id)
    .eq("slug", parsed.data.projectSlug)
    .maybeSingle();
  if (!project || project.status === "archived") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const result = await enqueuePackRun({
      organizationId: organization.id,
      projectId: project.id,
      userId: session.user.id,
      packKey: parsed.data.packKey,
      agentKind: parsed.data.agentKind,
      environmentVersionId: parsed.data.environmentVersionId,
      supabase: session.supabase,
    });
    return NextResponse.json(
      {
        evaluationRunId: result.runId,
        environmentVersionId: result.environmentVersionId,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Unable to start environment" }, { status: 400 });
  }
}
