import type { ValidationFindingDraft, ValidationSeverity } from "@agentforge/contracts";

import { FINDING_CODES } from "../finding-codes";
import { excerptMatchingLines, findFirstLine } from "../findings/excerpt";
import { atLine } from "../findings/factory";
import type { FindingCodeName } from "../finding-codes";
import { defineValidator } from "./define";

const INSPECTED_SUFFIXES = ["dockerfile", ".yml", ".yaml", ".sh", ".toml", ".json", ".py"] as const;

type StaticPattern = {
  readonly code: FindingCodeName;
  readonly pattern: RegExp;
  readonly severity: ValidationSeverity;
  readonly title: string;
  readonly message: string;
  readonly remediation: string;
};

/**
 * Static text patterns only. Nothing here is executed, and a match is reported as
 * "the package references X", never as "the task will do X".
 */
const PATTERNS: readonly StaticPattern[] = [
  {
    code: FINDING_CODES.TASK_SECURITY_DOCKER_SOCKET,
    pattern: /docker\.sock|\/var\/run\/docker/i,
    severity: "critical",
    title: "Package references the host Docker socket",
    message:
      "A file references the Docker socket path. Mounting it would give the task control of the host daemon.",
    remediation: "Remove docker.sock mounts and host-docker usage from the package.",
  },
  {
    code: FINDING_CODES.TASK_SECURITY_PRIVILEGED,
    pattern: /--privileged|\bprivileged\s*:\s*true\b/i,
    severity: "critical",
    title: "Package requests a privileged container",
    message:
      "A file requests privileged container execution, which removes container isolation from the sandbox.",
    remediation: "Drop privileged execution and request only the capabilities the task needs.",
  },
  {
    code: FINDING_CODES.TASK_SECURITY_PIPE_SHELL,
    pattern: /\b(curl|wget)\b[^\n]*\|\s*(ba)?sh\b/i,
    severity: "warning",
    title: "Package pipes a remote script into a shell",
    message:
      "A file downloads a script and pipes it to a shell. The content is not pinned, so the environment is not reproducible and not reviewable.",
    remediation: "Download to a file, pin a checksum, then run it.",
  },
];

function isInspectable(path: string): boolean {
  const lower = path.toLowerCase();
  return INSPECTED_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

export const securityValidator = defineValidator({
  id: "security",
  name: "Static security inspection",
  category: "security",
  version: "2.0.0",
  check(context, emit) {
    const findings: ValidationFindingDraft[] = [];

    for (const file of context.files) {
      if (!isInspectable(file)) {
        continue;
      }
      const text = context.workspace.readText(file);
      if (text === null) {
        continue;
      }
      for (const rule of PATTERNS) {
        if (!rule.pattern.test(text)) {
          continue;
        }
        findings.push(
          emit({
            code: rule.code,
            severity: rule.severity,
            title: rule.title,
            message: rule.message,
            location: atLine(file, findFirstLine(text, rule.pattern)),
            excerpt: excerptMatchingLines(text, rule.pattern, context.options),
            remediation: rule.remediation,
          }),
        );
      }
    }

    return findings;
  },
});
