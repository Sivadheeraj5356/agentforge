import { NextResponse } from "next/server";
import { ResetEnvironmentInputSchema, getExperiencePack } from "@agentforge/contracts";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { isApiError, requireApiSession } from "@/modules/api/v1/session";
import { enqueuePackRun } from "@/modules/environments/server/packs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  assertNeverExecutesUserCode("api v1 environments reset");
  const session = await requireApiSession(request);
  if (isApiError(session)) {
    return session;
  }
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = ResetEnvironmentInputSchema.safeParse({
    ...(typeof body === "object" && body !== null ? body : {}),
    environmentVersionId: id,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid environment reset request" }, { status: 400 });
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
    .select("id, slug, status")
    .eq("organization_id", organization.id)
    .eq("slug", parsed.data.projectSlug)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { data: env } = await session.supabase
    .from("environment_versions")
    .select("id, spec")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!env) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const spec = env.spec;
  const packKey =
    typeof spec === "object" && spec !== null && !Array.isArray(spec) && typeof spec.packKey === "string"
      ? spec.packKey
      : "";
  if (!packKey || !getExperiencePack(packKey)) {
    return NextResponse.json({ error: "Environment version has no pack key" }, { status: 400 });
  }
  try {
    const result = await enqueuePackRun({
      organizationId: organization.id,
      projectId: project.id,
      userId: session.user.id,
      packKey,
      agentKind: parsed.data.agentKind,
      environmentVersionId: env.id,
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
    return NextResponse.json({ error: "Unable to reset environment" }, { status: 400 });
  }
}
