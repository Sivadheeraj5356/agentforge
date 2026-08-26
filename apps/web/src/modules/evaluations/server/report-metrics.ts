import { median } from "@agentforge/contracts";

export function harnessLabel(kind: string | null, name: string | null): string {
  if (kind === "oracle" || name === "oracle") {
    return "oracle";
  }
  if (kind === "nop" || name === "nop") {
    return "NOP";
  }
  if (kind === "byo" || name === "byo") {
    return "byo";
  }
  if (kind === "multi_agent" || name === "multi-agent") {
    return "multi-agent";
  }
  if (kind === "agent" || name === "reference") {
    return "reference";
  }
  return name ?? kind ?? "unknown";
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function medianOrNull(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return median(values);
}
