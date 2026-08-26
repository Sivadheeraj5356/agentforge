import { describe, expect, it } from "vitest";

import { finiteNumber, harnessLabel, medianOrNull } from "./report-metrics";

describe("harnessLabel", () => {
  it("maps catalog kinds to report labels", () => {
    expect(harnessLabel("oracle", null)).toBe("oracle");
    expect(harnessLabel("nop", null)).toBe("NOP");
    expect(harnessLabel("agent", "reference")).toBe("reference");
    expect(harnessLabel("byo", "byo")).toBe("byo");
    expect(harnessLabel("multi_agent", null)).toBe("multi-agent");
  });
});

describe("finiteNumber and medianOrNull", () => {
  it("keeps recorded numbers and drops empty lists", () => {
    expect(finiteNumber(0.5)).toBe(0.5);
    expect(finiteNumber(null)).toBeNull();
    expect(medianOrNull([])).toBeNull();
    expect(medianOrNull([0, 1])).toBe(0.5);
  });
});
