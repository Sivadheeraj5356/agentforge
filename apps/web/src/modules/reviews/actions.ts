"use server";

import { FindingReviewDecisionSchema, WorkflowRoleSchema } from "@agentforge/contracts";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/modules/audit/server/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toJson } from "@/lib/json";
import { canManageProjects } from "@/modules/projects/permissions";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";

export type ReviewActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function assignWorkflowRoleAction(formData: FormData): Promise<void> {
  const organizationSlug = String(formData.get("organizationSlug") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const roleParsed = WorkflowRoleSchema.safeParse(formData.get("workflowRole"));
  const organization = await requireOrganizationBySlug(organizationSlug);
  if (!canManageProjects(organization.role) || !roleParsed.success || !userId) {
    throw new Error("Unable to assign workflow role.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("evaluation_workflow_memberships").insert({
    organization_id: organization.id,
    user_id: userId,
    workflow_role: roleParsed.data,
  });
  if (error) {
    throw new Error("Unable to assign workflow role.");
  }
  await recordAuditEvent({
    organizationId: organization.id,
    action: "workflow.role_assigned",
    metadata: { role: roleParsed.data },
  });
  revalidatePath(`/app/${organization.slug}/settings`);
  revalidatePath(`/app/${organization.slug}/reviews`);
}

export async function submitFindingReviewAction(
  _prev: ReviewActionResult | undefined,
  formData: FormData,
): Promise<ReviewActionResult> {
  const organizationSlug = String(formData.get("organizationSlug") ?? "");
  const findingId = String(formData.get("findingId") ?? "");
  const decisionParsed = FindingReviewDecisionSchema.safeParse(formData.get("decision"));
  const rationale = String(formData.get("rationale") ?? "").trim();
  const evidenceSummary = String(formData.get("evidenceSummary") ?? "").trim();
  if (!decisionParsed.success || rationale.length < 8 || evidenceSummary.length < 8) {
    return { ok: false, error: "Decision, rationale, and evidence summary are required." };
  }
  const organization = await requireOrganizationBySlug(organizationSlug);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in required." };
  }
  const { error } = await supabase.from("finding_reviews").insert({
    finding_id: findingId,
    organization_id: organization.id,
    reviewer_id: user.id,
    decision: decisionParsed.data,
    rationale,
    evidence: toJson({ summary: evidenceSummary }),
  });
  if (error) {
    return {
      ok: false,
      error: "Review could not be recorded. A second independent review may already exist.",
    };
  }
  revalidatePath(`/app/${organization.slug}/reviews`);
  return { ok: true, message: "Review submitted." };
}

export async function createEvaluationReviewAction(
  _prev: ReviewActionResult | undefined,
  formData: FormData,
): Promise<ReviewActionResult> {
  const organizationSlug = String(formData.get("organizationSlug") ?? "");
  const evaluationRunId = String(formData.get("evaluationRunId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (title.length < 1 || description.length < 8) {
    return { ok: false, error: "Title and description are required." };
  }
  const organization = await requireOrganizationBySlug(organizationSlug);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in required." };
  }
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      organization_id: organization.id,
      evaluation_run_id: evaluationRunId || null,
      created_by: user.id,
      status: "open",
    })
    .select("id")
    .single();
  if (reviewError || !review) {
    return { ok: false, error: "Review could not be opened." };
  }
  const { error: findingError } = await supabase.from("findings").insert({
    review_id: review.id,
    category: "evaluation-review",
    severity: "medium",
    title,
    description,
    evidence: toJson({ summary: description.slice(0, 200) }),
    source: "human",
    status: "open",
  });
  if (findingError) {
    return { ok: false, error: "Finding could not be created." };
  }
  revalidatePath(`/app/${organization.slug}/reviews`);
  return { ok: true, message: "Review opened." };
}
