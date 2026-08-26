import { describe, expect, it } from "vitest";

import { isSafeRelativePath } from "./paths";
import { redactSecrets } from "./redact";

describe("redactSecrets", () => {
  it("redacts bearer tokens", () => {
    expect(redactSecrets("Authorization: Bearer abc.def.ghi")).toContain("[REDACTED]");
  });
});

describe("isSafeRelativePath", () => {
  it("accepts nested relative paths", () => {
    expect(isSafeRelativePath("tasks/v1/instruction.md")).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(isSafeRelativePath("../secrets")).toBe(false);
  });
});
