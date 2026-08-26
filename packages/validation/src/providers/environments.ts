import type { EnvironmentAdapter, EnvironmentSpec } from "@agentforge/contracts";

/** Boundary only. Gmail/Slack/Salesforce are not implemented. */
export class UnsupportedEnvironmentAdapter implements EnvironmentAdapter {
  readonly id = "unsupported";
  readonly version = "1.0.0";

  provision(
    spec: EnvironmentSpec,
  ): Promise<{ readonly refused: true; readonly reason: string } | { readonly sessionId: string }> {
    if (spec.adapterId === "work") {
      return Promise.resolve({
        refused: true,
        reason:
          "Work environments start in services/evaluator only. The control plane stores pack and version ids.",
      });
    }
    return Promise.resolve({
      refused: true,
      reason: `Environment adapter '${spec.adapterId}' is not implemented. No fake Gmail, Slack, or Salesforce sessions.`,
    });
  }
}
