import {
  CreateProjectInputSchema,
  projectSlugWithSuffix,
  slugifyProjectName,
} from "@agentforge/contracts";

/** Pure helpers used by createProject — race-safe slug attempts. */
export function buildProjectSlugAttempts(name: string, maxAttempts = 8): string[] {
  const base = slugifyProjectName(name);
  return Array.from({ length: maxAttempts }, (_, attempt) => projectSlugWithSuffix(base, attempt));
}

export function validateCreateProjectPayload(input: unknown) {
  return CreateProjectInputSchema.safeParse(input);
}
