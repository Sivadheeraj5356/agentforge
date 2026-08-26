import { describe, expect, it } from "vitest";

import {
  CreateProjectInputSchema,
  ProjectListQuerySchema,
  ProjectSlugSchema,
  projectSlugWithSuffix,
  slugifyProjectName,
} from "./project";

describe("ProjectSlugSchema", () => {
  it("accepts valid slugs", () => {
    expect(ProjectSlugSchema.parse("alpha")).toBe("alpha");
    expect(ProjectSlugSchema.parse("my-eval-suite")).toBe("my-eval-suite");
  });

  it("rejects invalid slugs", () => {
    expect(() => ProjectSlugSchema.parse("-bad")).toThrow();
    expect(() => ProjectSlugSchema.parse("Bad")).toThrow();
    expect(() => ProjectSlugSchema.parse("a")).toThrow();
  });
});

describe("slugifyProjectName", () => {
  it("normalizes names into slugs", () => {
    expect(slugifyProjectName("  Harbor Suite! ")).toBe("harbor-suite");
    expect(slugifyProjectName("A")).toBe("project");
  });
});

describe("projectSlugWithSuffix", () => {
  it("appends bounded numeric suffixes", () => {
    expect(projectSlugWithSuffix("alpha", 0)).toBe("alpha");
    expect(projectSlugWithSuffix("alpha", 1)).toBe("alpha-2");
    expect(projectSlugWithSuffix("a".repeat(64), 1).length).toBeLessThanOrEqual(64);
  });
});

describe("CreateProjectInputSchema", () => {
  it("trims and validates", () => {
    expect(CreateProjectInputSchema.parse({ name: "  Demo  ", description: "  " })).toEqual({
      name: "Demo",
      description: undefined,
    });
    expect(() => CreateProjectInputSchema.parse({ name: "" })).toThrow();
  });
});

describe("ProjectListQuerySchema", () => {
  it("applies defaults", () => {
    expect(ProjectListQuerySchema.parse({})).toEqual({
      status: "active",
      q: undefined,
      sort: "updated_desc",
    });
  });
});
