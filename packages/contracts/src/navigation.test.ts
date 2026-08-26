import { describe, expect, it } from "vitest";

import { AppShellNavSchema } from "./navigation";

describe("AppShellNavSchema", () => {
  it("accepts a valid app shell navigation config", () => {
    const result = AppShellNavSchema.safeParse({
      primary: [
        { id: "home", label: "Home", href: "/app" },
        { id: "projects", label: "Projects", href: "/app/projects" },
        { id: "benchmarks", label: "Benchmarks", href: "/app/benchmarks" },
        { id: "evaluations", label: "Evaluations", href: "/app/evaluations" },
        { id: "results", label: "Results", href: "/app/results" },
      ],
      secondary: [
        { id: "docs", label: "Documentation", href: "/app/docs" },
        { id: "settings", label: "Settings", href: "/app/settings" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty primary navigation", () => {
    const result = AppShellNavSchema.safeParse({
      primary: [],
      secondary: [],
    });

    expect(result.success).toBe(false);
  });
});
