import type { Database, Json } from "@agentforge/contracts";
import { ValidationRunIdSchema } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export type ValidationRun = Database["public"]["Tables"]["validation_runs"]["Row"];
export type ValidationFinding = Database["public"]["Tables"]["validation_findings"]["Row"];

export async function getValidationRun(
  projectId: string,
  runId: string,
): Promise<ValidationRun | null> {
  await requireAuthenticatedUser();
  const parsed = ValidationRunIdSchema.safeParse(runId);
  if (!parsed.success) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("validation_runs")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", parsed.data)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load validation run.");
  }
  return data;
}

/**
 * Findings in the deterministic report order the pipeline assigned. `ordinal`
 * encodes severity, category, validator id, code, and source location.
 */
export async function getValidationFindings(runId: string): Promise<ValidationFinding[]> {
  await requireAuthenticatedUser();
  const parsed = ValidationRunIdSchema.safeParse(runId);
  if (!parsed.success) {
    return [];
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("validation_findings")
    .select("*")
    .eq("validation_run_id", parsed.data)
    .order("ordinal", { ascending: true });

  if (error) {
    throw new Error("Unable to load validation findings.");
  }
  return data ?? [];
}

export async function createValidationRun(input: {
  projectId: string;
  artifactId: string;
  submissionId: string | null;
}): Promise<ValidationRun> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("validation_runs")
    .insert({
      project_id: input.projectId,
      artifact_id: input.artifactId,
      submission_id: input.submissionId,
      status: "running",
      started_at: new Date().toISOString(),
      configuration: { schemaVersion: 1 } as Json,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Unable to create validation run.");
  }
  return data;
}
