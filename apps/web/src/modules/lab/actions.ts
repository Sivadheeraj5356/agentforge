"use server";

import { revalidatePath } from "next/cache";
import { EvaluatorConfigurationSchema } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toJson } from "@/lib/json";
import { canManageProjects } from "@/modules/projects/permissions";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import { requireProjectBySlug } from "@/modules/projects/server/projects";
import { recordAuditEvent } from "@/modules/audit/server/audit";
import { getHarnessAgent } from "@/modules/evaluations/server/catalog";

export type LabActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function createSuiteAction(
  _prev: LabActionResult | undefined,
  formData: FormData,
): Promise<LabActionResult> {
  const organizationSlug = String(formData.get("organizationSlug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const taskKey = String(formData.get("catalogTaskKey") ?? "");
  const minPass = Number(formData.get("minPassAt1") || 1);
  if (name.length < 1) {
    return { ok: false, error: "Suite name is required." };
  }
  const organization = await requireOrganizationBySlug(organizationSlug);
  if (!canManageProjects(organization.role)) {
    return { ok: false, error: "Owner or admin required." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in required." };
  }
  const { data: suite, error } = await supabase
    .from("evaluation_suites")
    .insert({
      organization_id: organization.id,
      name,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !suite) {
    return { ok: false, error: "Suite could not be created." };
  }
  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("external_key", taskKey)
    .limit(1)
    .maybeSingle();
  if (task) {
    const { data: version } = await supabase
      .from("task_versions")
      .select("id")
      .eq("task_id", task.id)
      .limit(1)
      .maybeSingle();
    if (version) {
      await supabase.from("evaluation_suite_members").insert({
        suite_id: suite.id,
        task_version_id: version.id,
        ordinal: 1,
      });
    }
  }
  await supabase.from("evaluation_gates").insert({
    suite_id: suite.id,
    metric: "pass_at_1",
    min_value: Number.isFinite(minPass) ? minPass : 1,
  });
  await recordAuditEvent({
    organizationId: organization.id,
    action: "suite.created",
    metadata: { name },
  });
  revalidatePath(`/app/${organization.slug}/suites`);
  return { ok: true, message: "Suite pinned. Queue it from Evaluations after assigning an agent." };
}

export async function createScenarioAction(
  _prev: LabActionResult | undefined,
  formData: FormData,
): Promise<LabActionResult> {
  const organizationSlug = String(formData.get("organizationSlug") ?? "");
  const projectSlug = String(formData.get("projectSlug") ?? "");
  const key = String(formData.get("key") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const requestText = String(formData.get("requestText") ?? "").trim();
  const difficulty = String(formData.get("difficulty") ?? "medium");
  const authoringSource = String(formData.get("authoringSource") ?? "human");
  if (key.length < 2 || name.length < 1 || requestText.length < 1) {
    return { ok: false, error: "Key, name, and request are required." };
  }
  const { organization, project } = await requireProjectBySlug(organizationSlug, projectSlug);
  if (!canManageProjects(organization.role)) {
    return { ok: false, error: "Owner or admin required." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in required." };
  }
  const { error } = await supabase.from("eval_scenarios").insert({
    organization_id: organization.id,
    project_id: project.id,
    key,
    name,
    request_text: requestText,
    difficulty,
    authoring_source: authoringSource === "ai_assisted" ? "ai_assisted" : "human",
    trusted: false,
    starting_state: toJson({}),
    expected_outcome: toJson({}),
    created_by: user.id,
  });
  if (error) {
    return { ok: false, error: "Scenario could not be created." };
  }
  revalidatePath(`/app/${organization.slug}/lab`);
  return {
    ok: true,
    message:
      authoringSource === "ai_assisted"
        ? "AI-assisted draft stored untrusted. Human review is required."
        : "Scenario stored.",
  };
}

export async function createDatasetVersionAction(
  _prev: LabActionResult | undefined,
  formData: FormData,
): Promise<LabActionResult> {
  const organizationSlug = String(formData.get("organizationSlug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  if (name.length < 1 || version.length < 1) {
    return { ok: false, error: "Name and version are required." };
  }
  const organization = await requireOrganizationBySlug(organizationSlug);
  if (!canManageProjects(organization.role)) {
    return { ok: false, error: "Owner or admin required." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in required." };
  }
  const { error } = await supabase.from("dataset_versions").insert({
    organization_id: organization.id,
    name,
    version,
    privacy_class: "PRIVATE",
    created_by: user.id,
  });
  if (error) {
    return { ok: false, error: "Dataset version could not be created." };
  }
  revalidatePath(`/app/${organization.slug}/lab`);
  return { ok: true, message: "Dataset version stored as PRIVATE. Customer data is not reusable." };
}

export async function createEnvironmentVersionAction(
  _prev: LabActionResult | undefined,
  formData: FormData,
): Promise<LabActionResult> {
  const organizationSlug = String(formData.get("organizationSlug") ?? "");
  const adapterId = String(formData.get("adapterId") ?? "isolated");
  const version = String(formData.get("version") ?? "").trim();
  const organization = await requireOrganizationBySlug(organizationSlug);
  if (!canManageProjects(organization.role) || version.length < 1) {
    return { ok: false, error: "Version is required." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("environment_versions").insert({
    organization_id: organization.id,
    adapter_id:
      adapterId === "harbor"
        ? "harbor"
        : adapterId === "unsupported"
          ? "unsupported"
          : adapterId === "work"
            ? "work"
            : "isolated",
    version,
    spec: toJson({ schemaVersion: 1 }),
  });
  if (error) {
    return { ok: false, error: "Environment version could not be created." };
  }
  revalidatePath(`/app/${organization.slug}/lab`);
  return { ok: true, message: "Environment version is immutable once written." };
}

export async function enqueueSuiteAction(
  _prev: LabActionResult | undefined,
  formData: FormData,
): Promise<LabActionResult> {
  const organizationSlug = String(formData.get("organizationSlug") ?? "");
  const projectSlug = String(formData.get("projectSlug") ?? "");
  const suiteId = String(formData.get("suiteId") ?? "");
  const agentKind = String(formData.get("agentKind") ?? "oracle");
  if (!suiteId) {
    return { ok: false, error: "Suite is required." };
  }
  const { organization, project } = await requireProjectBySlug(organizationSlug, projectSlug);
  if (!canManageProjects(organization.role)) {
    return { ok: false, error: "Owner or admin required." };
  }
  const supabase = await createSupabaseServerClient();
  const kind =
    agentKind === "nop" ||
    agentKind === "agent" ||
    agentKind === "multi_agent" ||
    agentKind === "byo"
      ? agentKind
      : "oracle";
  const agent = await getHarnessAgent(kind);
  const configuration = EvaluatorConfigurationSchema.parse({
    schemaVersion: 1,
    agentKind: kind,
    sandboxProvider: "isolated",
    attemptCount: 1,
    rewardRecipe: "binary",
  });
  const { data, error } = await supabase.rpc("enqueue_evaluation_suite", {
    p_suite_id: suiteId,
    p_project_id: project.id,
    p_agent_id: agent.id,
    p_evaluator_configuration: toJson(configuration),
  });
  if (error || !data) {
    return { ok: false, error: "Suite could not be queued." };
  }
  await recordAuditEvent({
    organizationId: organization.id,
    action: "suite.enqueued",
    metadata: { suiteId },
  });
  revalidatePath(`/app/${organization.slug}/suites`);
  revalidatePath(`/app/${organization.slug}/evaluations`);
  return { ok: true, message: "Suite queued. The evaluator worker claims each member run." };
}

export async function createWebhookEndpointAction(
  _prev: LabActionResult | undefined,
  formData: FormData,
): Promise<LabActionResult> {
  const organizationSlug = String(formData.get("organizationSlug") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  if (!url.startsWith("https://") && !url.startsWith("http://127.0.0.1")) {
    return { ok: false, error: "Webhook URL must be https or http://127.0.0.1." };
  }
  const organization = await requireOrganizationBySlug(organizationSlug);
  if (!canManageProjects(organization.role)) {
    return { ok: false, error: "Owner or admin required." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_webhook_endpoint", {
    p_organization_id: organization.id,
    p_url: url,
    p_events: ["evaluation.completed", "evaluation.failed", "regression.detected"],
  });
  if (error || !data) {
    return { ok: false, error: "Webhook could not be created." };
  }
  const secret =
    typeof data === "object" && data !== null && "secret" in data
      ? String((data as { secret: unknown }).secret)
      : "";
  revalidatePath(`/app/${organization.slug}/settings`);
  return {
    ok: true,
    message: secret
      ? `Webhook stored. Copy the signing secret now; it is not shown again: ${secret}`
      : "Webhook stored.",
  };
}
