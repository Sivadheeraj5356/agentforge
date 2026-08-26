import { describe, expect, it } from "vitest";

import { buildAppShellNav, workspaceShortcuts } from "./navigation";

describe("buildAppShellNav", () => {
  it("scopes a short primary list to the active organization", () => {
    const nav = buildAppShellNav("acme");
    expect(nav.primary.map((item) => item.href)).toEqual([
      "/app/acme",
      "/app/acme/projects",
      "/app/acme/evaluations",
      "/app/acme/environments",
    ]);
    expect(nav.secondary.map((item) => item.href)).toEqual([
      "/app/acme/docs",
      "/app/acme/settings",
    ]);
  });
});

describe("workspaceShortcuts", () => {
  it("keeps destaged destinations available by organization", () => {
    expect(workspaceShortcuts("acme").map((item) => item.href)).toEqual([
      "/app/acme/benchmarks",
      "/app/acme/trials",
      "/app/acme/results",
      "/app/acme/results/protocol",
      "/app/acme/reviews",
      "/app/acme/suites",
      "/app/acme/lab",
    ]);
  });
});
