import type { CiCheckAdapter, CiCheckConclusion } from "@agentforge/contracts";

/**
 * GitHub App PR checks. Not configured. GitHub types stay out of
 * `@agentforge/validation`.
 */
export class GitHubCheckAdapter implements CiCheckAdapter {
  readonly id = "github-app";

  publishCheck(_input: {
    readonly sha: string;
    readonly conclusion: CiCheckConclusion;
    readonly detailsUrl: string;
  }): Promise<void> {
    return Promise.reject(
      new Error("GitHub App is not configured. CI checks are not published."),
    );
  }
}
