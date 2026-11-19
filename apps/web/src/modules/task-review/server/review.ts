export type ReviewFindingInput = {
  readonly code: string;
  readonly severity: string;
  readonly category: string;
  readonly title: string;
  readonly message: string;
};

export type ReviewPromptInput = {
  readonly taskName: string;
  readonly externalKey: string;
  readonly taskVersion: string | null;
  readonly instruction: string | null;
  readonly manifestPaths: readonly string[];
  readonly findings: readonly ReviewFindingInput[];
};

export type TaskReview = {
  readonly summary: string;
  readonly difficulty: "easy" | "medium" | "hard" | "expert";
  readonly difficultyRationale: string;
  readonly strengths: readonly string[];
  readonly issues: readonly string[];
  readonly suggestions: readonly string[];
  readonly readiness: {
    readonly ready: boolean;
    readonly missing: readonly string[];
    readonly assessment: string;
  };
};

const MAX_INSTRUCTION_CHARS = 8000;
const MAX_MANIFEST_PATHS = 60;
const MAX_FINDINGS = 15;
const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;

export function buildReviewPrompt(input: ReviewPromptInput): string {
  const instruction = (input.instruction ?? "").slice(0, MAX_INSTRUCTION_CHARS);
  const paths = input.manifestPaths.slice(0, MAX_MANIFEST_PATHS);
  const findings = input.findings.slice(0, MAX_FINDINGS);

  const sections: string[] = [
    "You are reviewing a benchmark task used to evaluate AI agents. Judge the task as an exam question: is it clear, self-contained, fairly graded, and resistant to reward hacking.",
    "Answer with a single JSON object and no other text. The shape is:",
    '{"summary": string, "difficulty": "easy"|"medium"|"hard"|"expert", "difficultyRationale": string, "strengths": string[], "issues": string[], "suggestions": string[], "readiness": {"ready": boolean, "missing": string[], "assessment": string}}',
    "summary: two to four sentences an agent operator can skim. difficulty: how hard a capable coding agent would find this task. issues: concrete quality problems, empty array if none. suggestions: concrete fixes. readiness.ready: true only if the task could run in a benchmark today; missing lists what blocks that; assessment is one paragraph.",
    "",
    `Task name: ${input.taskName}`,
    `External key: ${input.externalKey}`,
    `Declared version: ${input.taskVersion ?? "none"}`,
    "",
    "Instruction given to the agent:",
    instruction.length > 0 ? instruction : "(no instruction file was found in the package)",
    "",
    `Files in the task package (${input.manifestPaths.length} total${input.manifestPaths.length > paths.length ? `, first ${paths.length} shown` : ""}):`,
    paths.map((path) => `- ${path}`).join("\n"),
    "",
    `Structural validation findings (${input.findings.length} total${input.findings.length > findings.length ? `, first ${findings.length} shown` : ""}):`,
    findings.length > 0
      ? findings
          .map(
            (finding) =>
              `- [${finding.severity}/${finding.category}] ${finding.code}: ${finding.title}. ${finding.message}`,
          )
          .join("\n")
      : "- none",
  ];
  return sections.join("\n");
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringList(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
  return items.map((entry) => entry.trim());
}

function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return null;
  }
  return candidate.slice(start, end + 1);
}

export function parseTaskReview(raw: string): TaskReview | null {
  const json = extractJson(raw);
  if (json === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const summary = asString(record.summary);
  const difficultyRationale = asString(record.difficultyRationale);
  const strengths = asStringList(record.strengths);
  const issues = asStringList(record.issues);
  const suggestions = asStringList(record.suggestions);
  const difficulty = DIFFICULTIES.find((level) => level === record.difficulty);
  const readinessRaw = record.readiness;
  if (!summary || !difficulty || !difficultyRationale || !strengths || !issues || !suggestions) {
    return null;
  }
  if (typeof readinessRaw !== "object" || readinessRaw === null) {
    return null;
  }
  const readinessRecord = readinessRaw as Record<string, unknown>;
  const assessment = asString(readinessRecord.assessment);
  const missing = asStringList(readinessRecord.missing);
  if (typeof readinessRecord.ready !== "boolean" || !assessment || !missing) {
    return null;
  }
  return {
    summary,
    difficulty,
    difficultyRationale,
    strengths,
    issues,
    suggestions,
    readiness: {
      ready: readinessRecord.ready,
      missing,
      assessment,
    },
  };
}
