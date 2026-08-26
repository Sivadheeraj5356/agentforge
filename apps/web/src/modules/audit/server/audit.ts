import type { Database, Json } from "@agentforge/contracts";
import { AuditActionSchema, AuditMetadataSchema } from "@agentforge/contracts";

import { logServerEvent } from "@/lib/server-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export type AuditEvent = Database["public"]["Tables"]["audit_events"]["Row"];

export async function listAuditEventsForOrganization(
  organizationId: string,
): Promise<AuditEvent[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error("Unable to load audit events.");
  }
  return data ?? [];
}

export async function recordAuditEvent(input: {
  organizationId: string;
  projectId?: string | null;
  action: unknown;
  metadata?: unknown;
}): Promise<void> {
  const user = await requireAuthenticatedUser();
  const action = AuditActionSchema.parse(input.action);
  const metadata = AuditMetadataSchema.parse(input.metadata ?? {});

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("audit_events").insert({
    actor_id: user.id,
    organization_id: input.organizationId,
    project_id: input.projectId ?? null,
    action,
    metadata: metadata as Json,
  });

  logServerEvent({
    level: error ? "warn" : "info",
    message: error ? "audit event insert failed" : "audit event recorded",
    action,
    organizationId: input.organizationId,
    projectId: input.projectId ?? undefined,
  });

  if (error) {
    throw new Error("Unable to record audit event.");
  }
}
