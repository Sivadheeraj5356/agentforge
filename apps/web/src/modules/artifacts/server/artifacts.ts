import type { Database } from "@agentforge/contracts";
import {
  ArtifactKindSchema,
  ArtifactStorageKeySchema,
  ContentTypeSchema,
  Sha256HexSchema,
} from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export type Artifact = Database["public"]["Tables"]["artifacts"]["Row"];

export async function listArtifactsForOrganization(organizationId: string): Promise<Artifact[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load artifacts.");
  }
  return data ?? [];
}

/** Metadata insert. Bytes live in ArtifactStore, never in Postgres. */
export async function recordArtifactMetadata(
  organizationId: string,
  input: {
    kind: unknown;
    contentHash: unknown;
    byteSize: number;
    contentType: unknown;
    storageKey?: unknown;
  },
): Promise<Artifact> {
  await requireAuthenticatedUser();
  const kind = ArtifactKindSchema.parse(input.kind);
  const contentHash = Sha256HexSchema.parse(input.contentHash);
  const contentType = ContentTypeSchema.parse(input.contentType);
  const storageKey =
    input.storageKey === undefined || input.storageKey === null
      ? null
      : ArtifactStorageKeySchema.parse(input.storageKey);

  if (!Number.isInteger(input.byteSize) || input.byteSize < 0) {
    throw new Error("Invalid artifact size.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("artifacts")
    .insert({
      organization_id: organizationId,
      kind,
      content_hash: contentHash,
      byte_size: input.byteSize,
      content_type: contentType,
      storage_key: storageKey,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Unable to record artifact metadata.");
  }
  return data;
}
