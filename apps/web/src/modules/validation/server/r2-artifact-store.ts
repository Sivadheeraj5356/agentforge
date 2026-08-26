import type { ArtifactStore, ArtifactStoreMetadata } from "@agentforge/contracts";
import { ArtifactStorageKeySchema } from "@agentforge/contracts";

import { presignR2Get, signR2Headers, type R2SignerConfig } from "./r2-s3";

export function readR2SignerConfig(): R2SignerConfig | null {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  if (!accessKeyId || !secretAccessKey || !accountId || !bucket) {
    return null;
  }
  return {
    accessKeyId,
    secretAccessKey,
    accountId,
    bucket,
    region: process.env.R2_REGION?.trim() || "auto",
  };
}

export function createR2ArtifactStore(
  config: R2SignerConfig,
  fetchImpl: typeof fetch = fetch,
): ArtifactStore {
  return {
    async put(key: string, body: Uint8Array, meta?: ArtifactStoreMetadata): Promise<void> {
      const parsed = ArtifactStorageKeySchema.parse(key);
      const extraHeaders: Record<string, string> = {
        "If-None-Match": "*",
      };
      if (meta?.contentType) {
        extraHeaders["Content-Type"] = meta.contentType;
      }
      const signed = signR2Headers({
        config,
        method: "PUT",
        objectKey: parsed,
        payload: body,
        extraHeaders,
      });
      const response = await fetchImpl(signed.url, {
        method: "PUT",
        headers: signed.headers,
        body: body as unknown as BodyInit,
      });
      if (!response.ok) {
        throw new Error(`R2 put failed (${response.status}).`);
      }
    },
    async get(key: string): Promise<Uint8Array> {
      const parsed = ArtifactStorageKeySchema.parse(key);
      const signed = signR2Headers({
        config,
        method: "GET",
        objectKey: parsed,
        payload: "",
      });
      const response = await fetchImpl(signed.url, {
        method: "GET",
        headers: signed.headers,
      });
      if (!response.ok) {
        throw new Error(`R2 get failed (${response.status}).`);
      }
      return new Uint8Array(await response.arrayBuffer());
    },
    async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
      const parsed = ArtifactStorageKeySchema.parse(key);
      return presignR2Get({
        config,
        objectKey: parsed,
        expiresInSeconds,
      });
    },
  };
}
