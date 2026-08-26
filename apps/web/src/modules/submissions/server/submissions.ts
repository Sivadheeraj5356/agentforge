import type { Database, Json } from "@agentforge/contracts";
import { SubmissionKindSchema, SubmissionMetadataSchema } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export type Submission = Database["public"]["Tables"]["submissions"]["Row"];

async function projectIdsForOrganization(organizationId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error("Unable to load projects.");
  }
  return (data ?? []).map((row) => row.id);
}

export async function listSubmissionsForOrganization(
  organizationId: string,
): Promise<Submission[]> {
  await requireAuthenticatedUser();
  const projectIds = await projectIdsForOrganization(organizationId);
  if (projectIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load submissions.");
  }
  return data ?? [];
}

export async function createSubmission(
  projectId: string,
  input: { kind: unknown; metadata?: unknown },
): Promise<Submission> {
  const user = await requireAuthenticatedUser();
  const kind = SubmissionKindSchema.parse(input.kind);
  const metadata = SubmissionMetadataSchema.parse(input.metadata ?? {});

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      project_id: projectId,
      kind,
      metadata: metadata as Json,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Unable to create submission.");
  }
  return data;
}
