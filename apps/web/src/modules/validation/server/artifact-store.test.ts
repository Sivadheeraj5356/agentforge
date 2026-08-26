import { describe, expect, it } from "vitest";

import { ArtifactStorageKeySchema } from "@agentforge/contracts";
import { isSafeRelativePath } from "@agentforge/security";

import { buildArtifactStorageKey } from "./artifact-store";

describe("buildArtifactStorageKey", () => {
  it("scopes keys by organization and hash", () => {
    const orgId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const objectId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const hash = "ab".repeat(32);
    const key = buildArtifactStorageKey(orgId, objectId, hash);
    expect(key).toContain(`orgs/${orgId}/ingest/`);
    expect(key.endsWith(`${hash}.zip`)).toBe(true);
    expect(ArtifactStorageKeySchema.parse(key)).toBe(key);
    expect(isSafeRelativePath(key)).toBe(true);
  });
});
