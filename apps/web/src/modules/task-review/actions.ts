"use server";

import {
  OrganizationSlugSchema,
  ProjectSlugSchema,
  TaskSlugSchema,
  ValidationRunNumberSchema,
} from "@agentforge/contracts";

import { recordAuditEvent } from "@/modules/audit/server/audit";
import { canManageProjects } from "@/modules/projects/permissions";
import { loadTaskManifest, readTaskFile } from "@/modules/tasks/server/file-content";
import { loadRunFindings, requireTaskRunContext } from "@/modules/tasks/server/task-runs";
import { generateReviewJson } from "@/modules/task-review/server/providers";
import {
  buildReviewPrompt,
  parseTaskReview,
  type ReviewFindingInput,
  type TaskReview,
} from "@/modules/task-review/server/review";

export type TaskReviewActionResult =
  | { readonly ok: true; readonly review: TaskReview; readonly model: string }
  | { readonly ok: false; readonly error: string };

function instructionPathFor(rootPath: string): string {
  return rootPath.length > 0 ? `${rootPath}/instruction.md` : "instruction.md";
}

export async function requestTaskReviewAction(
  _prev: TaskReviewActionResult | undefined,
  formData: FormData,
): Promise<TaskReviewActionResult> {
  const orgParsed = OrganizationSlugSchema.safeParse(formData.get("organizationSlug"));
  const projectParsed = ProjectSlugSchema.safeParse(formData.get("projectSlug"));
  const taskParsed = TaskSlugSchema.safeParse(formData.get("taskSlug"));
  const runParsed = ValidationRunNumberSchema.safeParse(formData.get("runNumber"));
  if (!orgParsed.success || !projectParsed.success || !taskParsed.success || !runParsed.success) {
    return { ok: false, error: "Invalid task review request." };
  }

  try {
    const context = await requireTaskRunContext({
      organizationSlug: orgParsed.data,
      projectSlug: projectParsed.data,
      taskSlug: taskParsed.data,
      runNumber: String(runParsed.data),
    });
    const { organization, project, task, run } = context;
    if (!canManageProjects(organization.role)) {
      return { ok: false, error: "Owner or admin required." };
    }

    const manifest = await loadTaskManifest(context, context.siblingTaskRootPaths);
    const findings = await loadRunFindings(run.id, run.validators);

    let instruction: string | null = null;
    const instructionPath = instructionPathFor(task.rootPath);
    if (manifest.some((entry) => entry.path === instructionPath)) {
      const file = await readTaskFile(context, instructionPath, manifest);
      if (file.ok) {
        instruction = file.content.lines.join("\n");
      }
    }

    const prompt = buildReviewPrompt({
      taskName: task.name,
      externalKey: task.externalKey,
      taskVersion: task.taskVersion,
      instruction,
      manifestPaths: manifest.map((entry) => entry.path),
      findings: findings.map((finding): ReviewFindingInput => ({
        code: finding.code,
        severity: finding.severity,
        category: finding.category,
        title: finding.title,
        message: finding.message,
      })),
    });

    const generated = await generateReviewJson(prompt);
    if (!generated.ok) {
      return { ok: false, error: generated.error };
    }
    const review = parseTaskReview(generated.text);
    if (!review) {
      return {
        ok: false,
        error: "The review service returned a response that was not a readable review. Try again.",
      };
    }

    await recordAuditEvent({
      organizationId: organization.id,
      projectId: project.id,
      action: "task.reviewed",
      metadata: { taskSlug: task.slug, runNumber: run.run_number, model: generated.model },
    });
    return { ok: true, review, model: generated.model };
  } catch {
    return { ok: false, error: "The task review could not be completed." };
  }
}
