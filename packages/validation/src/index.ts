export { FINDING_CODES } from "./finding-codes";
export type { FindingCodeName } from "./finding-codes";
export { sha256Hex } from "./hash";
export {
  MAX_UPLOAD_ARCHIVE_BYTES,
  MAX_EXTRACTED_ARCHIVE_BYTES,
  MAX_ARCHIVE_FILE_COUNT,
  MAX_SINGLE_EXTRACTED_FILE_BYTES,
  MAX_COMPRESSION_RATIO,
  MAX_ARCHIVE_PATH_LENGTH,
  MAX_WORKSPACE_PATH_LENGTH,
  MAX_TEXT_FILE_BYTES,
  MAX_FINDINGS_PER_RUN,
} from "./limits";

export {
  inspectZip,
  extractZipEntries,
  readZipEntry,
  createStoredZip,
  createZipWithRawPath,
  createZipWithClaimedSizes,
} from "./archive/zip";
export type { ZipInspection } from "./archive/zip";
export { ArchiveError } from "./archive/bytes";

export { runValidationPipeline } from "./pipeline/run";
export type { ValidationPipelineInput } from "./pipeline/run";
export type { DiagnosticEvent, DiagnosticEventName, DiagnosticsSink } from "./pipeline/diagnostics";

export { compareFindings, fingerprintFinding, normalizeFindings } from "./findings/normalize";
export {
  decideOutcome,
  resolvePolicy,
  LENIENT_POLICY,
  STRICT_POLICY,
  type ValidationPolicy,
} from "./policy/policy";

export { createValidatorRegistry } from "./validators/registry";
export { defineValidator } from "./validators/define";
export type { ValidatorDefinition } from "./validators/define";

export { TerminusAdapter } from "./terminus/adapter";
export { TerminalBenchAdapter } from "./terminal-bench/adapter";
export { SweBenchAdapter } from "./swe-bench/adapter";
export { BenchmarkAdapterRefusedError } from "./errors";
export { createTerminusValidatorRegistry } from "./terminus/validators";
export { createBenchmarkAdapterRegistry, createDefaultBenchmarkAdapterRegistry } from "./registry";
export type { AdapterMatch, BenchmarkAdapterRegistry } from "./registry";

export { createWorkspaceReader } from "./workspace/reader";
export { WorkspaceReadError } from "./workspace/reader";
export { loadWorkspaceSnapshot } from "./workspace/snapshot";
export type { WorkspaceSnapshot } from "./workspace/snapshot";
export { WorkspacePathError, joinWorkspacePath, normalizeWorkspacePath } from "./workspace/paths";
export { ancestorDirectories, buildFileTree, visibleTreeNodes } from "./workspace/tree";
export type {
  FileTreeDirectory,
  FileTreeFile,
  FileTreeNode,
  ManifestEntry,
} from "./workspace/tree";

export { manifestForTaskRoot, manifestFromInspection } from "./content/manifest";
export {
  buildTextFilePreview,
  classifyBySize,
  sanitizeDisplayText,
  splitDisplayLines,
  FULL_RENDER_MAX_BYTES,
  MAX_RENDERED_LINE_CHARACTERS,
  PREVIEW_MAX_BYTES,
  PREVIEW_MAX_LINES,
} from "./content/text";
export type { FileRenderMode, TextFilePreview } from "./content/text";

export { assignTaskSlugs, taskSlugFromExternalKey, MAX_TASK_SLUG_LENGTH } from "./tasks/slug";

export { compareValidationRuns, severityDrift } from "./compare/runs";
export type {
  ChangedFinding,
  ComparableFinding,
  ComparableRun,
  SeverityDrift,
  ValidationRunComparison,
} from "./compare/runs";

export { unimplementedReviewProvider, unimplementedAnalysisProvider } from "./providers/stubs";
export { UnsupportedEnvironmentAdapter } from "./providers/environments";

export {
  FIXTURE_EXPECTATIONS,
  FIXTURE_IDS,
  fixtureExpectation,
  fixturePackage,
  fixtureZip,
  validTerminusZip,
} from "./fixtures";
export type { FixtureExpectation, FixtureFile, FixtureId, FixturePackage } from "./fixtures";
