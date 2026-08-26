import { z } from "zod";

/**
 * Runtime schemas for uploaded task documents. TypeScript interfaces are not
 * runtime validation: uploads are parsed, then checked here before any validator
 * reasons about the values. Unknown keys pass through so a newer Harbor field is
 * never reported as an error.
 */

const positiveSeconds = z.number().positive().max(86_400);

export const TerminusTaskMetadataSchema = z
  .object({
    author_name: z.string().max(200).optional(),
    author_email: z.string().max(200).optional(),
    category: z.string().max(128).optional(),
    difficulty: z.string().max(64).optional(),
    tags: z.array(z.string().max(64)).max(32).optional(),
  })
  .passthrough();

export const TerminusVerifierSchema = z
  .object({
    timeout_sec: positiveSeconds.optional(),
    environment_mode: z.enum(["shared", "separate"]).optional(),
    entrypoint: z.string().min(1).max(240).optional(),
  })
  .passthrough();

export const TerminusAgentSchema = z
  .object({
    timeout_sec: positiveSeconds.optional(),
  })
  .passthrough();

export const TerminusEnvironmentSchema = z
  .object({
    build_timeout_sec: positiveSeconds.optional(),
    cpus: z.number().positive().max(256).optional(),
    memory_mb: z.number().int().positive().max(1_048_576).optional(),
    base_image: z.string().min(1).max(240).optional(),
  })
  .passthrough();

/** Harbor-style `task.toml`. */
export const TerminusTaskTomlSchema = z
  .object({
    version: z.string().max(64).optional(),
    artifacts: z.array(z.string().max(1024)).max(64).optional(),
    metadata: TerminusTaskMetadataSchema.optional(),
    verifier: TerminusVerifierSchema.optional(),
    agent: TerminusAgentSchema.optional(),
    environment: TerminusEnvironmentSchema.optional(),
  })
  .passthrough();

/** Classic Terminal Bench `task.yaml`. */
export const ClassicTaskYamlSchema = z
  .object({
    instruction: z.string().max(100_000).optional(),
    version: z.string().max(64).optional(),
    author_name: z.string().max(200).optional(),
    author_email: z.string().max(200).optional(),
    category: z.string().max(128).optional(),
    difficulty: z.string().max(64).optional(),
    tags: z.array(z.string().max(64)).max(32).optional(),
    max_agent_timeout_sec: positiveSeconds.optional(),
    max_test_timeout_sec: positiveSeconds.optional(),
  })
  .passthrough();

/** Subset of `package.json` used for mutable-dependency detection. */
export const NodePackageManifestSchema = z
  .object({
    dependencies: z.record(z.string(), z.string().max(200)).optional(),
    devDependencies: z.record(z.string(), z.string().max(200)).optional(),
  })
  .passthrough();

export type TerminusTaskToml = z.infer<typeof TerminusTaskTomlSchema>;
export type ClassicTaskYaml = z.infer<typeof ClassicTaskYamlSchema>;
export type NodePackageManifest = z.infer<typeof NodePackageManifestSchema>;

export type SchemaIssue = {
  readonly fieldPath: string;
  readonly message: string;
};

/** Flattens Zod issues into dotted field paths the report can cite. */
export function toSchemaIssues(error: z.ZodError): readonly SchemaIssue[] {
  return error.issues.map((issue) => ({
    fieldPath: issue.path.map((part) => String(part)).join("."),
    message: issue.message,
  }));
}
