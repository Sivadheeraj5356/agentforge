/**
 * The part of `@agentforge/validation` that is safe in a browser bundle.
 *
 * The main entry point reaches Node built-ins — `node:zlib` for archives,
 * `node:fs` for workspaces, `node:crypto` for hashing — because the pipeline runs
 * on a server. Importing it from a client component drags all of that into the
 * browser build, so anything a client component needs is re-exported here and
 * nowhere else.
 *
 * Rule of thumb: if a module in this package imports `node:*`, it does not belong
 * in this file, directly or transitively.
 */

export { ancestorDirectories, buildFileTree, visibleTreeNodes } from "./workspace/tree";
export type {
  FileTreeDirectory,
  FileTreeFile,
  FileTreeNode,
  ManifestEntry,
} from "./workspace/tree";

export { WorkspacePathError, joinWorkspacePath, normalizeWorkspacePath } from "./workspace/paths";

export {
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
