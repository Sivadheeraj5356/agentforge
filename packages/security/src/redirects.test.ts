import { describe, expect, it } from "vitest";

import { getSafeRedirectPath } from "./redirects";

describe("getSafeRedirectPath", () => {
  it("allows safe relative paths", () => {
    expect(getSafeRedirectPath("/app")).toBe("/app");
    expect(getSafeRedirectPath("/app/acme")).toBe("/app/acme");
    expect(getSafeRedirectPath("/settings")).toBe("/settings");
  });

  it("rejects open redirects", () => {
    expect(getSafeRedirectPath("https://evil.com")).toBe("/app");
    expect(getSafeRedirectPath("//evil.com")).toBe("/app");
    expect(getSafeRedirectPath("javascript:alert(1)")).toBe("/app");
    expect(getSafeRedirectPath("data:text/html,hi")).toBe("/app");
    expect(getSafeRedirectPath("\\evil")).toBe("/app");
    expect(getSafeRedirectPath("")).toBe("/app");
    expect(getSafeRedirectPath(null)).toBe("/app");
  });

  it("supports custom fallback", () => {
    expect(getSafeRedirectPath("//evil", "/login")).toBe("/login");
  });
});
