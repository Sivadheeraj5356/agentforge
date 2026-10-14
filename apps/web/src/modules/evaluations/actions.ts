"use server";

import { randomUUID } from "node:crypto";
import {
  EnqueueEvaluationInputSchema,
  OrganizationSlugSchema,
  ProjectSlugSchema,
} from "@agentforge/contracts";
import { revalidatePath } from "next/cache";

import { logServerEvent } from "@/lib/server-log";
import { recordAuditEvent } from "@/modules/audit/server/audit";
import { getCatalogTaskByKey, getHarnessAgent } from "@/modules/evaluations/server/catalog";
import {
  cancelEvaluationRun,
  enqueueEvaluationRun,
} from "@/modules/evaluations/server/evaluation-runs";
import { createPlannedExperiment } from "@/modules/evaluations/server/experiments";
import { canManageProjects } from "@/modules/projects/permissions";
import { requireProjectBySlug } from "@/modules/projects/server/projects";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const MODEL_KINDS = new Set(["agent", "multi_agent", "byo"]);

async function enqueueParsed(parsed: {
  organizationSlug: string;
  projectSlug: string;
  catalogTaskKey?: string;
  agentKind: "oracle" | "nop" | "agent" | "multi_agent" | "byo";
  attemptCount: number;
  rewardRecipe: "binary" | "continuous" | "hybrid" | "staged";
  sandboxProvider: "harbor" | "isolated" | "fake" | "work";
  composition?: "single" | "multi_agent";
  ablationId?: string;
}): Promise<ActionResult> {
  if (MODEL_KINDS.has(parsed.agentKind) && parsed.sandboxProvider === "fake") {
    return {
      ok: false,
      error:
        "Reference, multi-agent, and BYO runs require Isolated or Work. Fake is fixtures-only.",
    };
  }
  const { organization, project } = await requireProjectBySlug(
    parsed.organizationSlug,
    parsed.projectSlug,
  );
  if (!canManageProjects(organization.role)) {
    return { ok: false, error: "You do not have permission to enqueue evaluations." };
  }
  if (project.status === "archived") {
    return { ok: false, error: "Archived projects cannot enqueue evaluations." };
  }
  const catalogTask = parsed.catalogTaskKey
    ? await getCatalogTaskByKey(parsed.catalogTaskKey)
    : null;
  if (!catalogTask) {
    return { ok: false, error: "Unknown catalog task." };
  }
  const agent = await getHarnessAgent(parsed.agentKind);
  const run = await enqueueEvaluationRun({
    projectId: project.id,
    kind: catalogTask.benchmarkKey === "terminal-bench" ? "benchmark_provided" : "internal_package",
    metadata: {
      schemaVersion: 1,
      catalogTaskKey: catalogTask.taskKey,
    },
    benchmarkVersionId: catalogTask.benchmarkVersionId,
    taskVersionId: catalogTask.taskVersionId,
    agentId: agent.id,
    evaluatorConfiguration: {
      schemaVersion: 1,
      agentKind: parsed.agentKind,
      attemptCount: parsed.attemptCount,
      rewardRecipe: parsed.rewardRecipe,
      sandboxProvider: parsed.sandboxProvider,
      composition:
        parsed.agentKind === "multi_agent" ? "multi_agent" : (parsed.composition ?? "single"),
      ...(parsed.ablationId ? { ablationId: parsed.ablationId } : {}),
    },
  });
  await recordAuditEvent({
    organizationId: organization.id,
    projectId: project.id,
    action: "evaluation.enqueued",
    metadata: { runNumber: run.run_number, agent: parsed.agentKind },
  });
  logServerEvent({
    level: "info",
    message: "evaluation enqueued",
    action: "evaluation.enqueued",
    organizationId: organization.id,
    projectId: project.id,
  });
  revalidatePath(`/app/${organization.slug}/evaluations`);
  revalidatePath(`/app/${organization.slug}/trials`);
  revalidatePath(`/app/${organization.slug}/results`);
  return {
    ok: true,
    message: `Queued run ${run.run_number}. Start the evaluator worker to execute it.`,
  };
}

export async function enqueueEvaluationAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = EnqueueEvaluationInputSchema.safeParse({
    organizationSlug: formData.get("organizationSlug"),
    projectSlug: formData.get("projectSlug"),
    catalogTaskKey: formData.get("catalogTaskKey") || undefined,
    agentKind: formData.get("agentKind") || "oracle",
    attemptCount: Number(formData.get("attemptCount") || 1),
    rewardRecipe: formData.get("rewardRecipe") || "binary",
    sandboxProvider: formData.get("sandboxProvider") || "isolated",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the evaluation fields." };
  }
  try {
    return await enqueueParsed(parsed.data);
  } catch {
    return { ok: false, error: "Evaluation could not be queued." };
  }
}

export async function enqueueAblationAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ablationId = randomUUID();
  const recipes = ["binary", "continuous", "hybrid"] as const;
  const parsed = EnqueueEvaluationInputSchema.safeParse({
    organizationSlug: formData.get("organizationSlug"),
    projectSlug: formData.get("projectSlug"),
    catalogTaskKey: formData.get("catalogTaskKey") || undefined,
    agentKind: "oracle",
    attemptCount: Number(formData.get("attemptCount") || 1),
    rewardRecipe: "binary",
    sandboxProvider: formData.get("sandboxProvider") || "isolated",
    ablationId,
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the ablation fields." };
  }
  try {
    const { organization, project } = await requireProjectBySlug(
      parsed.data.organizationSlug,
      parsed.data.projectSlug,
    );
    if (!canManageProjects(organization.role)) {
      return { ok: false, error: "You do not have permission to enqueue evaluations." };
    }
    await createPlannedExperiment({
      organizationId: organization.id,
      projectId: project.id,
      name: `ablation ${ablationId.slice(0, 8)}`,
      stage: "ablation",
      rewardRecipe: "binary",
      splitSeed: 1,
      heldOutCount: 2,
      notes: `Reward recipe ablation ${ablationId}. Metrics stay empty until worker scores exist.`,
    });
    let last: ActionResult = { ok: false, error: "Ablation did not enqueue." };
    for (const recipe of recipes) {
      last = await enqueueParsed({ ...parsed.data, rewardRecipe: recipe, ablationId });
      if (!last.ok) {
        return last;
      }
    }
    return {
      ok: true,
      message: "Queued binary, continuous, and hybrid oracle runs. Scores appear after the worker.",
    };
  } catch {
    return { ok: false, error: "Ablation could not be queued." };
  }
}

export async function cancelEvaluationAction(formData: FormData): Promise<void> {
  const orgParsed = OrganizationSlugSchema.safeParse(formData.get("organizationSlug"));
  const runId = formData.get("runId");
  if (!orgParsed.success || typeof runId !== "string") {
    throw new Error("Invalid evaluation run.");
  }
  const organization = await requireOrganizationBySlug(orgParsed.data);
  if (!canManageProjects(organization.role)) {
    throw new Error("You do not have permission to cancel evaluations.");
  }
  await cancelEvaluationRun(runId);
  revalidatePath(`/app/${organization.slug}/evaluations`);
}

export async function createExperimentAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const orgParsed = OrganizationSlugSchema.safeParse(formData.get("organizationSlug"));
  const projectParsed = ProjectSlugSchema.safeParse(formData.get("projectSlug"));
  const name = String(formData.get("name") ?? "").trim();
  const stage = formData.get("stage");
  const rewardRecipe = formData.get("rewardRecipe");
  const splitSeed = Number(formData.get("splitSeed") || 1);
  const heldOutCount = Number(formData.get("heldOutCount") || 2);
  if (
    !orgParsed.success ||
    !projectParsed.success ||
    name.length < 1 ||
    (stage !== "base" && stage !== "sft" && stage !== "grpo" && stage !== "ablation") ||
    (rewardRecipe !== "binary" && rewardRecipe !== "continuous" && rewardRecipe !== "hybrid")
  ) {
    return { ok: false, error: "Check the experiment fields." };
  }
  try {
    const { organization, project } = await requireProjectBySlug(
      orgParsed.data,
      projectParsed.data,
    );
    if (!canManageProjects(organization.role)) {
      return { ok: false, error: "You do not have permission to record experiments." };
    }
    await createPlannedExperiment({
      organizationId: organization.id,
      projectId: project.id,
      name,
      stage,
      rewardRecipe,
      splitSeed,
      heldOutCount,
    });
    await recordAuditEvent({
      organizationId: organization.id,
      projectId: project.id,
      action: "training.experiment_planned",
      metadata: { stage, name },
    });
    revalidatePath(`/app/${organization.slug}/results`);
    return {
      ok: true,
      message: "Experiment recorded as planned. Metrics stay empty until a real run.",
    };
  } catch {
    return { ok: false, error: "Experiment could not be recorded." };
  }
}
