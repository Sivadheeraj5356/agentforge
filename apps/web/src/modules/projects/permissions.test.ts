import { describe, expect, it } from "vitest";

import { canManageProjects } from "./permissions";

describe("canManageProjects", () => {
  it("allows owner and admin only", () => {
    expect(canManageProjects("owner")).toBe(true);
    expect(canManageProjects("admin")).toBe(true);
    expect(canManageProjects("member")).toBe(false);
  });
});
