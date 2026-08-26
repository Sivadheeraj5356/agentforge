import { describe, expect, it } from "vitest";

import { UnsupportedEnvironmentAdapter } from "./environments";

describe("UnsupportedEnvironmentAdapter", () => {
  it("refuses unimplemented SaaS environments", async () => {
    const result = await new UnsupportedEnvironmentAdapter().provision({
      adapterId: "unsupported",
      version: "1.0.0",
    });
    expect(result).toMatchObject({ refused: true });
    if ("reason" in result) {
      expect(result.reason).toMatch(/Gmail|Slack|Salesforce/i);
    }
  });

  it("refuses work environments from the control plane", async () => {
    const result = await new UnsupportedEnvironmentAdapter().provision({
      adapterId: "work",
      version: "incident-eu-1.0.0",
    });
    expect(result).toMatchObject({ refused: true });
    if ("reason" in result) {
      expect(result.reason).toMatch(/evaluator/i);
    }
  });
});
