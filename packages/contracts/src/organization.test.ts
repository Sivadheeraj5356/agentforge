import { describe, expect, it } from "vitest";

import {
  EnvironmentAdapterIdSchema,
  OrganizationRoleSchema,
  OrganizationSlugSchema,
  PrivacyClassSchema,
  WorkflowRoleSchema,
  normalizeOrganizationSlug,
} from "./organization";

describe("OrganizationSlugSchema", () => {
  it("accepts valid slugs", () => {
    expect(OrganizationSlugSchema.parse("acme")).toBe("acme");
    expect(OrganizationSlugSchema.parse("my-workspace")).toBe("my-workspace");
    expect(OrganizationSlugSchema.parse("personal-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(
      "personal-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("rejects invalid slugs", () => {
    expect(() => OrganizationSlugSchema.parse("-bad")).toThrow();
    expect(() => OrganizationSlugSchema.parse("bad-")).toThrow();
    expect(() => OrganizationSlugSchema.parse("Bad")).toThrow();
    expect(() => OrganizationSlugSchema.parse("has space")).toThrow();
    expect(() => OrganizationSlugSchema.parse("a")).toThrow();
  });
});

describe("normalizeOrganizationSlug", () => {
  it("lowercases and strips invalid characters", () => {
    expect(normalizeOrganizationSlug("  Acme Corp! ")).toBe("acme-corp");
    expect(normalizeOrganizationSlug("--hello--")).toBe("hello");
  });
});

describe("workflow and privacy enums", () => {
  it("keeps reviewer roles out of organization roles", () => {
    expect(WorkflowRoleSchema.parse("reviewer")).toBe("reviewer");
    expect(WorkflowRoleSchema.parse("adjudicator")).toBe("adjudicator");
    expect(() => OrganizationRoleSchema.parse("reviewer")).toThrow();
    expect(PrivacyClassSchema.parse("PRIVATE")).toBe("PRIVATE");
    expect(EnvironmentAdapterIdSchema.parse("work")).toBe("work");
  });
});
