import type { ReactElement } from "react";
import type {
  ValidationOutcome,
  ValidationRunStatus,
  ValidationSeverity,
} from "@agentforge/contracts";

import { cn } from "@agentforge/ui";

/**
 * Severity is never carried by colour alone: every appearance pairs a shape, a
 * word, and a tone. The shapes differ between `critical` and `error` because both
 * use the danger colour.
 */

export const SEVERITY_LABEL: Record<ValidationSeverity, string> = {
  critical: "Critical",
  error: "Error",
  warning: "Warning",
  info: "Info",
};

const SEVERITY_TONE: Record<ValidationSeverity, string> = {
  critical: "text-danger",
  error: "text-danger",
  warning: "text-warning",
  info: "text-muted-foreground",
};

export function severityTone(severity: ValidationSeverity): string {
  return SEVERITY_TONE[severity];
}

export function SeverityIcon({
  severity,
  className,
}: {
  severity: ValidationSeverity;
  className?: string;
}): ReactElement {
  const shared = {
    viewBox: "0 0 12 12",
    "aria-hidden": true as const,
    focusable: "false" as const,
    className: cn("size-3 shrink-0", className),
  };

  switch (severity) {
    case "critical":
      return (
        <svg {...shared}>
          <path d="M6 0.6 11.4 10.2H0.6Z" fill="currentColor" />
          <path d="M6 4v3" stroke="var(--color-background)" strokeWidth="1.3" />
          <circle cx="6" cy="8.6" r="0.7" fill="var(--color-background)" />
        </svg>
      );
    case "error":
      return (
        <svg {...shared}>
          <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 3.2v3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="6" cy="8.7" r="0.8" fill="currentColor" />
        </svg>
      );
    case "warning":
      return (
        <svg {...shared}>
          <path
            d="M6 1.1 11 10.4H1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M6 4.6v2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "info":
      return (
        <svg {...shared}>
          <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 5.4v3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="6" cy="3.5" r="0.7" fill="currentColor" />
        </svg>
      );
  }
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: ValidationSeverity;
  className?: string;
}): ReactElement {
  return (
    <span className={cn("inline-flex items-center gap-1.5", SEVERITY_TONE[severity], className)}>
      <SeverityIcon severity={severity} />
      <span>{SEVERITY_LABEL[severity]}</span>
    </span>
  );
}

export const OUTCOME_COPY: Record<ValidationOutcome, { label: string; detail: string }> = {
  pass: {
    label: "Passed",
    detail: "Every enabled check ran and reported nothing.",
  },
  warn: {
    label: "Passed with warnings",
    detail: "The package is usable, but some checks reported advisory findings.",
  },
  fail: {
    label: "Failed",
    detail: "At least one check reported a finding the current policy fails on.",
  },
};

const OUTCOME_TONE: Record<ValidationOutcome, string> = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-danger",
};

const OUTCOME_MARK: Record<ValidationOutcome, string> = {
  pass: "✓",
  warn: "▲",
  fail: "✕",
};

export function OutcomeBadge({
  outcome,
  status,
  className,
}: {
  outcome: ValidationOutcome | null;
  status: ValidationRunStatus;
  className?: string;
}): ReactElement {
  if (!outcome || status === "failed" || status === "cancelled") {
    return (
      <span className={cn("text-muted-foreground inline-flex items-center gap-1.5", className)}>
        <span aria-hidden="true" className="font-mono text-xs">
          —
        </span>
        <span>{status === "failed" ? "Did not complete" : "No verdict"}</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", OUTCOME_TONE[outcome], className)}>
      <span aria-hidden="true" className="font-mono text-xs">
        {OUTCOME_MARK[outcome]}
      </span>
      <span>{OUTCOME_COPY[outcome].label}</span>
    </span>
  );
}
