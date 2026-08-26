import { describe, expect, it } from "vitest";

import { GitHubCheckAdapter } from "./github-check-adapter";

describe("GitHubCheckAdapter", () => {
  it("refuses until a GitHub App is configured", async () => {
    await expect(
      new GitHubCheckAdapter().publishCheck({
        sha: "abc1234",
        conclusion: "success",
        detailsUrl: "http://127.0.0.1:3000",
      }),
    ).rejects.toThrow(/not configured/);
  });
});
