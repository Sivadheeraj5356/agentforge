import type { ValidatorId } from "@agentforge/contracts";

export type DiagnosticEventName =
  | "archive.rejected"
  | "benchmark.undetected"
  | "benchmark.refused"
  | "validator.failed"
  | "findings.truncated";

/**
 * Operator-facing diagnostic. The pipeline never writes to the console itself and
 * never puts a stack trace in a report; the host decides how to log.
 */
export type DiagnosticEvent = {
  readonly level: "warn" | "error";
  readonly event: DiagnosticEventName;
  readonly detail: string;
  readonly validatorId?: ValidatorId;
  readonly taskRootPath?: string;
};

export type DiagnosticsSink = (event: DiagnosticEvent) => void;

export const noopDiagnostics: DiagnosticsSink = () => {};
