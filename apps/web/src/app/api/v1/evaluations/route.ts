import { NextResponse } from "next/server";
import {
  EnqueueEvaluationInputSchema,
  EvaluatorConfigurationSchema,
  harnessCatalogLookup,
  type EvaluationAgentKind,
} from "@agentforge/contracts";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { isApiError, requireApiSession, type ApiSupabase } from "@/modules/api/v1/session";
import { toJson } from "@/lib/json";

async function resolveProject(
  supabase: ApiSupabase,
  organizationSlug: string,
  projectSlug: string,
) {
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, slug")
    .eq("slug", organizationSlug)
    .maybeSingle();
  if (!organization) {
    return null;
  }
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, organization_id, status")
    .eq("organization_id", organization.id)
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) {
    return null;
  }
  return { organization, project };
}

async function catalogTask(supabase: ApiSupabase, taskKey: string) {
  const { data: task } = await supabase
    .from("tasks")
    .select("id, external_key, benchmark_version_id")
    .eq("external_key", taskKey)
    .limit(1)
    .maybeSingle();
  if (!task) {
    return null;
  }
  const { data: version } = await supabase
    .from("task_versions")
    .select("id, version")
    .eq("task_id", task.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) {
    return null;
  }
  return { task, version };
}

async function harnessAgent(supabase: ApiSupabase, kind: EvaluationAgentKind) {
  const lookup = harnessCatalogLookup(kind);
  const { data } = await supabase
    .from("agents")
    .select("id")
    .eq("provider", lookup.provider)
    .eq("name", lookup.name)
    .eq("version", "1.0.0")
    .maybeSingle();
  return data;
}

export async function POST(request: Request): Promise<Response> {
  assertNeverExecutesUserCode("api v1 create evaluation");
  const session = await requireApiSession(request);
  if (isApiError(session)) {
    return session;
  }
  const body = await request.json().catch(() => null);
  const parsed = EnqueueEvaluationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid evaluation request" }, { status: 400 });
  }
  const input = parsed.data;
  if (!input.catalogTaskKey || !input.projectSlug) {
    return NextResponse.json({ error: "catalogTaskKey and projectSlug are required" }, { status: 400 });
  }
  const scoped = await resolveProject(
    session.supabase,
    input.organizationSlug,
    input.projectSlug,
  );
  if (!scoped) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const task = await catalogTask(session.supabase, input.catalogTaskKey);
  const agent = await harnessAgent(session.supabase, input.agentKind);
  if (!task || !agent) {
    return NextResponse.json({ error: "Unknown catalog task or agent" }, { status: 400 });
  }
  const configuration = EvaluatorConfigurationSchema.parse({
    schemaVersion: 1,
    agentKind: input.agentKind,
    attemptCount: input.attemptCount,
    rewardRecipe: input.rewardRecipe,
    sandboxProvider: input.sandboxProvider,
    composition: input.composition,
  });
  const { data, error } = await session.supabase.rpc("enqueue_evaluation", {
    p_project_id: scoped.project.id,
    p_kind: "internal_package",
    p_metadata: toJson({ schemaVersion: 1, catalogTaskKey: input.catalogTaskKey }),
    p_benchmark_version_id: task.task.benchmark_version_id,
    p_task_version_id: task.version.id,
    p_agent_id: agent.id,
    p_evaluator_configuration: toJson(configuration),
  });
  if (error || !data) {
    return NextResponse.json({ error: "Unable to enqueue evaluation" }, { status: 400 });
  }
  return NextResponse.json({ evaluation: data }, { status: 201 });
}
