"use server";

import { revalidatePath } from "next/cache";
import { ResetEnvironmentInputSchema, StartEnvironmentInputSchema } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/modules/audit/server/audit";
import { enqueuePackRun } from "@/modules/environments/server/packs";
import { requireProjectBySlug } from "@/modules/projects/server/projects";
import { canManageProjects } from "@/modules/projects/permissions";

export type EnvironmentActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function startEnvironmentAction(
  _prev: EnvironmentActionResult | undefined,
  formData: FormData,
): Promise<EnvironmentActionResult> {
  const parsed = StartEnvironmentInputSchema.safeParse({
    organizationSlug: formData.get("organizationSlug"),
    projectSlug: formData.get("projectSlug"),
    packKey: formData.get("packKey"),
    agentKind: formData.get("agentKind") || "oracle",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the environment fields." };
  }
  try {
    const { organization, project } = await requireProjectBySlug(
      parsed.data.organizationSlug,
      parsed.data.projectSlug,
    );
    if (!canManageProjects(organization.role)) {
      return { ok: false, error: "Owner or admin required." };
    }
    if (project.status === "archived") {
      return { ok: false, error: "Archived projects cannot start environments." };
    }
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Sign in required." };
    }
    const result = await enqueuePackRun({
      organizationId: organization.id,
      projectId: project.id,
      userId: user.id,
      packKey: parsed.data.packKey,
      agentKind: parsed.data.agentKind,
      supabase,
    });
    await recordAuditEvent({
      organizationId: organization.id,
      projectId: project.id,
      action: "environment.started",
      metadata: { packKey: parsed.data.packKey, runId: result.runId },
    });
    revalidatePath(`/app/${organization.slug}/environments`);
    revalidatePath(`/app/${organization.slug}/evaluations`);
    return {
      ok: true,
      message: "Pack run queued. Stage scores appear after the evaluator worker.",
    };
  } catch {
    return { ok: false, error: "Environment could not be started." };
  }
}

export async function resetEnvironmentAction(
  _prev: EnvironmentActionResult | undefined,
  formData: FormData,
): Promise<EnvironmentActionResult> {
  const parsed = ResetEnvironmentInputSchema.safeParse({
    organizationSlug: formData.get("organizationSlug"),
    projectSlug: formData.get("projectSlug"),
    environmentVersionId: formData.get("environmentVersionId"),
    agentKind: formData.get("agentKind") || "oracle",
  });
  if (!parsed.success) {
    return { ok: false, error: "Check the reset fields." };
  }
  try {
    const { organization, project } = await requireProjectBySlug(
      parsed.data.organizationSlug,
      parsed.data.projectSlug,
    );
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
    const { data: env } = await supabase
      .from("environment_versions")
      .select("id, spec")
      .eq("id", parsed.data.environmentVersionId)
      .eq("organization_id", organization.id)
      .maybeSingle();
    if (!env) {
      return { ok: false, error: "Environment version not found." };
    }
    const spec = env.spec;
    const packKey =
      typeof spec === "object" &&
      spec !== null &&
      !Array.isArray(spec) &&
      typeof spec.packKey === "string"
        ? spec.packKey
        : "";
    if (!packKey) {
      return { ok: false, error: "Environment version has no pack key." };
    }
    await enqueuePackRun({
      organizationId: organization.id,
      projectId: project.id,
      userId: user.id,
      packKey,
      agentKind: parsed.data.agentKind,
      environmentVersionId: env.id,
      supabase,
    });
    await recordAuditEvent({
      organizationId: organization.id,
      action: "environment.reset",
      metadata: { environmentVersionId: env.id, packKey },
    });
    revalidatePath(`/app/${organization.slug}/environments`);
    return { ok: true, message: "Reset queued as a new job on the same environment version." };
  } catch {
    return { ok: false, error: "Environment could not be reset." };
  }
}
