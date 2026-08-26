import { describe, expect, it } from "vitest";

import { buildProjectSlugAttempts, validateCreateProjectPayload } from "./slug";

describe("buildProjectSlugAttempts", () => {
  it("produces unique bounded attempts", () => {
    const attempts = buildProjectSlugAttempts("Alpha Suite");
    expect(attempts[0]).toBe("alpha-suite");
    expect(attempts[1]).toBe("alpha-suite-2");
    expect(new Set(attempts).size).toBe(attempts.length);
    expect(attempts.every((slug) => slug.length <= 64)).toBe(true);
  });
});

describe("validateCreateProjectPayload", () => {
  it("rejects empty names and oversized descriptions", () => {
    expect(validateCreateProjectPayload({ name: "   " }).success).toBe(false);
    expect(
      validateCreateProjectPayload({ name: "Ok", description: "x".repeat(2001) }).success,
    ).toBe(false);
    expect(validateCreateProjectPayload({ name: "Ok", description: "Notes" }).success).toBe(true);
  });
});
