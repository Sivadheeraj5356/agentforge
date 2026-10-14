import type { ArtifactStore, ArtifactStoreMetadata } from "@agentforge/contracts";
import { ArtifactStorageKeySchema } from "@agentforge/contracts";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const ARTIFACT_BUCKET = "agentforge-artifacts";

/** Private Supabase Storage bucket. Used when no R2 credentials are set and a service key exists. */
export function createSupabaseArtifactStore(): ArtifactStore {
  const bucket = () => createSupabaseServiceRoleClient().storage.from(ARTIFACT_BUCKET);
  return {
    async put(key: string, body: Uint8Array, meta?: ArtifactStoreMetadata): Promise<void> {
      const parsed = ArtifactStorageKeySchema.parse(key);
      const { error } = await bucket().upload(parsed, body, {
        contentType: meta?.contentType ?? "application/octet-stream",
        upsert: false,
      });
      if (error) {
        throw new Error(`Storage put failed: ${error.message}`);
      }
    },
    async get(key: string): Promise<Uint8Array> {
      const parsed = ArtifactStorageKeySchema.parse(key);
      const { data, error } = await bucket().download(parsed);
      if (error || !data) {
        throw new Error(`Storage get failed: ${error?.message ?? "no data"}`);
      }
      return new Uint8Array(await data.arrayBuffer());
    },
    async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
      const parsed = ArtifactStorageKeySchema.parse(key);
      const { data, error } = await bucket().createSignedUrl(parsed, expiresInSeconds);
      if (error || !data) {
        throw new Error(`Storage sign failed: ${error?.message ?? "no url"}`);
      }
      return data.signedUrl;
    },
  };
}
