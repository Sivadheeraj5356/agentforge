import { describe, expect, it } from "vitest";

import {
  AuditActionSchema,
  AuditMetadataSchema,
  BenchmarkManifestSchema,
  CatalogKeySchema,
  EvaluatorConfigurationSchema,
  harnessCatalogLookup,
  Sha256HexSchema,
  SubmissionKindSchema,
  VersionIdentitySchema,
} from "./domain";

describe("CatalogKeySchema", () => {
  it("accepts kebab keys", () => {
    expect(CatalogKeySchema.parse("terminal-bench")).toBe("terminal-bench");
    expect(CatalogKeySchema.parse("harbor")).toBe("harbor");
  });

  it("rejects invalid keys", () => {
    expect(() => CatalogKeySchema.parse("Terminus")).toThrow();
    expect(() => CatalogKeySchema.parse("-bad")).toThrow();
    expect(() => CatalogKeySchema.parse("a")).toThrow();
  });
});

describe("VersionIdentitySchema", () => {
  it("accepts pinned identities and rejects latest aliases", () => {
    expect(VersionIdentitySchema.parse("1.0.0")).toBe("1.0.0");
    expect(VersionIdentitySchema.parse("2026-08-16")).toBe("2026-08-16");
    expect(() => VersionIdentitySchema.parse("latest")).toThrow();
    expect(() => VersionIdentitySchema.parse("../1")).toThrow();
    expect(() => VersionIdentitySchema.parse("")).toThrow();
  });
});

describe("Sha256HexSchema", () => {
  it("accepts lowercase 64-char hex", () => {
    const hash = "a".repeat(64);
    expect(Sha256HexSchema.parse(hash)).toBe(hash);
  });

  it("rejects non-sha256 values", () => {
    expect(() => Sha256HexSchema.parse("abc")).toThrow();
    expect(() => Sha256HexSchema.parse("A".repeat(64))).toThrow();
  });
});

describe("SubmissionKindSchema", () => {
  it("is a closed discriminator set", () => {
    expect(SubmissionKindSchema.parse("uploaded_archive")).toBe("uploaded_archive");
    expect(SubmissionKindSchema.parse("git_commit")).toBe("git_commit");
    expect(() => SubmissionKindSchema.parse("zip")).toThrow();
  });
});

describe("BenchmarkManifestSchema", () => {
  it("requires schemaVersion 1 and forbids unknown fields", () => {
    expect(BenchmarkManifestSchema.parse({ schemaVersion: 1 })).toEqual({ schemaVersion: 1 });
    expect(() =>
      BenchmarkManifestSchema.parse({ schemaVersion: 1, terminus_task_id: "tb" }),
    ).toThrow();
  });
});

describe("EvaluatorConfigurationSchema", () => {
  it("rejects non-positive timeouts", () => {
    expect(() =>
      EvaluatorConfigurationSchema.parse({ schemaVersion: 1, timeoutSeconds: 0 }),
    ).toThrow();
    expect(
      EvaluatorConfigurationSchema.parse({
        schemaVersion: 1,
        composition: "multi_agent",
        ablationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      }),
    ).toMatchObject({ composition: "multi_agent" });
  });
});

describe("AuditActionSchema and AuditMetadataSchema", () => {
  it("accepts dotted actions", () => {
    expect(AuditActionSchema.parse("project.created")).toBe("project.created");
    expect(() => AuditActionSchema.parse("GET")).toThrow();
  });

  it("rejects secret-shaped metadata keys", () => {
    expect(AuditMetadataSchema.parse({ slug: "alpha" })).toEqual({ slug: "alpha" });
    expect(() => AuditMetadataSchema.parse({ apiKey: "sk-test" })).toThrow();
    expect(() => AuditMetadataSchema.parse({ password: "x" })).toThrow();
  });
});

describe("harnessCatalogLookup", () => {
  it("maps agent kinds to the AgentForge catalog, not Harbor Terminus-2", () => {
    expect(harnessCatalogLookup("agent")).toEqual({ provider: "agentforge", name: "reference" });
    expect(harnessCatalogLookup("byo")).toEqual({ provider: "agentforge", name: "byo" });
    expect(harnessCatalogLookup("oracle")).toEqual({ provider: "agentforge", name: "oracle" });
    expect(harnessCatalogLookup("multi_agent")).toEqual({
      provider: "agentforge",
      name: "multi-agent",
    });
  });
});
