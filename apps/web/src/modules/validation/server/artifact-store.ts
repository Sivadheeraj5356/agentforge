import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ArtifactStore, ArtifactStoreMetadata } from "@agentforge/contracts";
import { ArtifactStorageKeySchema } from "@agentforge/contracts";
import { isSafeRelativePath } from "@agentforge/security";

import { createSupabaseArtifactStore } from "./supabase-artifact-store";
import { createR2ArtifactStore, readR2SignerConfig } from "./r2-artifact-store";

function resolveStoreRoot(): string {
  const configured =
    process.env.AGENTFORGE_ARTIFACT_STORE_DIR?.trim() ||
    process.env.VORTEX_ARTIFACT_STORE_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  const cwd = process.cwd();
  if (cwd.endsWith(`${path.sep}apps${path.sep}web`) || cwd.endsWith("/apps/web")) {
    return path.resolve(cwd, "../../.data/untrusted-ingest");
  }
  return path.resolve(cwd, ".data/untrusted-ingest");
}

export function buildArtifactStorageKey(
  organizationId: string,
  objectId: string,
  contentHash: string,
): string {
  const key = `orgs/${organizationId}/ingest/${objectId}/${contentHash}.zip`;
  return ArtifactStorageKeySchema.parse(key);
}

export function createLocalFilesystemArtifactStore(
  rootDirectory = resolveStoreRoot(),
): ArtifactStore {
  const root = path.resolve(rootDirectory);

  function resolveKey(key: string): string {
    const parsed = ArtifactStorageKeySchema.parse(key);
    if (!isSafeRelativePath(parsed)) {
      throw new Error("Unsafe artifact storage key.");
    }
    const destination = path.resolve(root, parsed);
    const relative = path.relative(root, destination);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Unsafe artifact storage key.");
    }
    return destination;
  }

  return {
    async put(key: string, body: Uint8Array, _meta?: ArtifactStoreMetadata): Promise<void> {
      const destination = resolveKey(key);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, body, { flag: "wx" });
    },
    async get(key: string): Promise<Uint8Array> {
      const destination = resolveKey(key);
      const data = await readFile(destination);
      return new Uint8Array(data);
    },
    async getSignedUrl(_key: string, _expiresInSeconds: number): Promise<string> {
      return Promise.reject(new Error("Local ArtifactStore does not issue signed URLs."));
    },
  };
}

/** R2 when operator credentials are set; local filesystem otherwise. */
export function createArtifactStore(): ArtifactStore {
  const r2 = readR2SignerConfig();
  if (r2) {
    return createR2ArtifactStore(r2);
  }
  if (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
    process.env.AGENTFORGE_ARTIFACT_BACKEND !== "local"
  ) {
    return createSupabaseArtifactStore();
  }
  return createLocalFilesystemArtifactStore();
}
