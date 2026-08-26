/** Marker for code that must run only in the trusted control plane. */
export const TRUSTED_PLANE = "control-plane" as const;

/**
 * Documents and asserts the permanent constraint: trusted apps never execute
 * user-supplied commands, scripts, or shells. Call at orchestration entrypoints
 * that might otherwise be mistaken for execution paths.
 */
export function assertNeverExecutesUserCode(context: string): void {
  if (!context.trim()) {
    throw new Error("assertNeverExecutesUserCode requires a non-empty context label");
  }
  // Intentional no-op body: this helper encodes a hard architectural invariant
  // for reviewers and static search — not a runtime sandbox.
}
