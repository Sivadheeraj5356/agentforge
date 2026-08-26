/**
 * Adapter abstractions. Concrete benchmark adapters live in `@agentforge/validation`.
 * Control plane validates and orchestrates. Execution plane runs sandboxed work.
 * Trusted apps must never execute user-supplied code directly.
 */

import type {
  DetectionResult,
  DiscoveredTask,
  TaskDocument,
  TaskDefinition,
  ValidationConfiguration,
  ValidationReport,
  ValidatorRegistry,
  WorkspaceReader,
} from "./validation";

export type ParsedTask = {
  readonly definition: TaskDefinition;
  readonly document: TaskDocument | null;
};

/**
 * Normalizes Harbor / Terminal Bench / custom task formats into canonical structures.
 * An adapter discovers and parses; the pipeline owns validator execution, error
 * isolation, normalization, and policy. Adapters never run validators themselves.
 */
export interface BenchmarkAdapter {
  readonly id: string;
  readonly version: string;
  detect(workspace: WorkspaceReader): DetectionResult;
  /** Single discovery pass: task roots only, no parsing. */
  discoverTasks(workspace: WorkspaceReader): readonly DiscoveredTask[];
  /** Single parse phase: cached representations the whole run shares. */
  parseTask(workspace: WorkspaceReader, task: DiscoveredTask): ParsedTask;
  validators(): ValidatorRegistry;
}

export type ArtifactStoreMetadata = {
  contentType?: string;
};

/** Artifact storage (local filesystem default; R2 when R2_* is set). Postgres stores keys/hashes only. */
export interface ArtifactStore {
  put(key: string, body: Uint8Array, meta?: ArtifactStoreMetadata): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

/**
 * LLM / human review — interface only. Deterministic validation never calls this,
 * and no implementation is wired. See ADR-015.
 */
export interface ReviewProvider {
  readonly id: string;
  review(input: { report: ValidationReport }): Promise<{ notes: string }>;
}

/** Secondary analysis (future). Deterministic validators must not depend on this. */
export interface AnalysisProvider {
  readonly id: string;
  analyze(input: {
    configuration: ValidationConfiguration;
    report: ValidationReport;
  }): Promise<{ notes: string }>;
}

/** Model inference provider (OpenAI, Anthropic, etc.) — execution plane only. */
export interface ModelProvider {
  readonly id: string;
  complete(request: { prompt: string }): Promise<{ text: string }>;
}

export type AgentKind = "oracle" | "nop" | "agent" | "multi_agent";

/** Agent harness adapter. Implementations live in the evaluator, never Next.js. */
export interface AgentAdapter {
  readonly id: string;
  readonly kind: AgentKind;
  prepareRun(config: { runId: string }): Promise<{ prepared: boolean }>;
}

export type SandboxRole = "agent" | "grader";

/**
 * Isolated sandbox provider (Harbor / Docker). Never in the trusted app process.
 * Agent and grader sessions must be distinct — hidden tests stay off the agent FS.
 */
export interface SandboxProvider {
  readonly id: string;
  createSession(spec: {
    imageRef: string;
    role: SandboxRole;
    taskDir?: string;
  }): Promise<{ sessionId: string }>;
  destroySession(sessionId: string): Promise<void>;
}

/** Async job queue for evaluation trials. Postgres-backed in Chunk 8. */
export interface JobQueue {
  enqueue(job: { type: string; payload: Record<string, string> }): Promise<{ jobId: string }>;
  getStatus(
    jobId: string,
  ): Promise<"queued" | "claimed" | "running" | "succeeded" | "failed" | "cancelled">;
}

export type EnvironmentSpec = {
  readonly adapterId: "harbor" | "isolated" | "unsupported" | "work";
  readonly version: string;
  readonly startingState?: Record<string, unknown>;
};

/**
 * External environment boundary (Gmail/Slack/Salesforce later).
 * Implementations live in the evaluator. Control plane stores ids only.
 */
export interface EnvironmentAdapter {
  readonly id: string;
  readonly version: string;
  provision(
    spec: EnvironmentSpec,
  ): Promise<{ readonly refused: true; readonly reason: string } | { readonly sessionId: string }>;
}

export type CiCheckConclusion = "success" | "failure" | "neutral";

/**
 * GitHub App / PR checks stay behind this adapter so GitHub types never
 * leak into `@agentforge/validation`.
 */
export interface CiCheckAdapter {
  readonly id: string;
  publishCheck(input: {
    readonly sha: string;
    readonly conclusion: CiCheckConclusion;
    readonly detailsUrl: string;
  }): Promise<void>;
}
