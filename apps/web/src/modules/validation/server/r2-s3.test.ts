import { describe, expect, it, vi } from "vitest";

import { createArtifactStore } from "./artifact-store";
import { createR2ArtifactStore } from "./r2-artifact-store";
import { presignR2Get, signR2Headers } from "./r2-s3";

const config = {
  accessKeyId: "AKIAEXAMPLE",
  secretAccessKey: "secret",
  accountId: "acct",
  bucket: "agentforge-artifacts",
  region: "auto",
};

describe("R2 signer", () => {
  it("signs PUT headers and presigns GET", () => {
    const now = new Date("2026-08-25T00:00:00.000Z");
    const signed = signR2Headers({
      config,
      method: "PUT",
      objectKey: "orgs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/ingest/x/ab.zip",
      payload: new Uint8Array([1, 2, 3]),
      now,
    });
    expect(signed.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=/);
    expect(signed.url).toContain("acct.r2.cloudflarestorage.com/agentforge-artifacts/orgs/");
    const url = presignR2Get({
      config,
      objectKey: "orgs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/ingest/x/ab.zip",
      expiresInSeconds: 60,
      now,
    });
    expect(url).toContain("X-Amz-Signature=");
  });
});

describe("createR2ArtifactStore", () => {
  it("PUTs org-prefixed keys", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const store = createR2ArtifactStore(config, fetchImpl as unknown as typeof fetch);
    await store.put("orgs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/obj.bin", new Uint8Array([9]));
    expect(fetchImpl).toHaveBeenCalledOnce();
    const first = fetchImpl.mock.calls[0] as unknown as [string] | undefined;
    const url = String(first?.[0] ?? "");
    expect(url).toContain("/agentforge-artifacts/orgs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/obj.bin");
  });
});

describe("createArtifactStore", () => {
  it("uses local filesystem when R2 env is unset", async () => {
    const previous = {
      id: process.env.R2_ACCESS_KEY_ID,
      secret: process.env.R2_SECRET_ACCESS_KEY,
      account: process.env.R2_ACCOUNT_ID,
      bucket: process.env.R2_BUCKET_NAME,
    };
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_BUCKET_NAME;
    const store = createArtifactStore();
    await expect(store.getSignedUrl("orgs/example/x.bin", 60)).rejects.toThrow(/signed URLs/);
    if (previous.id) process.env.R2_ACCESS_KEY_ID = previous.id;
    if (previous.secret) process.env.R2_SECRET_ACCESS_KEY = previous.secret;
    if (previous.account) process.env.R2_ACCOUNT_ID = previous.account;
    if (previous.bucket) process.env.R2_BUCKET_NAME = previous.bucket;
  });
});
