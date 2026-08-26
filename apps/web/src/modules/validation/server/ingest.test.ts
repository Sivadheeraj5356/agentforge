import { fixtureZip } from "@agentforge/validation";
import { describe, expect, it } from "vitest";

import { isZipMagic, ValidationJobError } from "./ingest";

describe("isZipMagic", () => {
  it("accepts a real archive and rejects other uploads", () => {
    expect(isZipMagic(fixtureZip("valid"))).toBe(true);
    expect(isZipMagic(new TextEncoder().encode("PK not really a zip"))).toBe(false);
    expect(isZipMagic(new Uint8Array([0x1f, 0x8b, 0x08, 0x00]))).toBe(false);
    expect(isZipMagic(new Uint8Array())).toBe(false);
  });
});

describe("ValidationJobError", () => {
  it("carries a user-safe message and a correlation id for operators", () => {
    const error = new ValidationJobError("Validation could not be completed.", "abc-123");
    expect(error.message).toBe("Validation could not be completed.");
    expect(error.correlationId).toBe("abc-123");
    expect(error.message).not.toMatch(/stack|at |\.ts:/);
  });
});
