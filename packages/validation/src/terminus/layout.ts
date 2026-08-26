import type { WorkspaceReader } from "@agentforge/contracts";

import { joinWorkspacePath } from "../workspace/paths";

/** Conventional Harbor / Terminal Bench file names. No magic strings elsewhere. */
export const TERMINUS_PATHS = {
  instruction: "instruction.md",
  taskToml: "task.toml",
  taskYaml: "task.yaml",
  taskYml: "task.yml",
  tasksDirectory: "tasks",
  testsDirectory: "tests",
  environmentDirectory: "environment",
  solutionDirectory: "solution",
  environmentDockerfile: "environment/Dockerfile",
  testsDockerfile: "tests/Dockerfile",
  environmentPackageManifest: "environment/package.json",
  readmeMarkdown: "README.md",
  readme: "README",
} as const;

/** Files that identify a directory as a task root. */
export const TASK_MARKER_FILES: readonly string[] = [
  TERMINUS_PATHS.taskToml,
  TERMINUS_PATHS.taskYaml,
  TERMINUS_PATHS.taskYml,
  TERMINUS_PATHS.instruction,
];

export function metadataPaths(taskRoot: string): readonly string[] {
  return [TERMINUS_PATHS.taskToml, TERMINUS_PATHS.taskYaml, TERMINUS_PATHS.taskYml].map((name) =>
    joinWorkspacePath(taskRoot, name),
  );
}

export function instructionPath(taskRoot: string): string {
  return joinWorkspacePath(taskRoot, TERMINUS_PATHS.instruction);
}

export function dockerfileCandidates(taskRoot: string): readonly string[] {
  return [
    "environment/Dockerfile",
    "environment/dockerfile",
    "Dockerfile",
    "docker-compose.yaml",
    "docker-compose.yml",
  ].map((name) => joinWorkspacePath(taskRoot, name));
}

export function testEntrypointCandidates(taskRoot: string): readonly string[] {
  return ["tests/test.sh", "run-tests.sh", "tests/test_outputs.py", "tests/test.py"].map((name) =>
    joinWorkspacePath(taskRoot, name),
  );
}

export function solutionCandidates(taskRoot: string): readonly string[] {
  return ["solution/solve.sh", "solution.sh"].map((name) => joinWorkspacePath(taskRoot, name));
}

function hasAnyMarker(workspace: WorkspaceReader, directory: string): boolean {
  return TASK_MARKER_FILES.some((name) => workspace.exists(joinWorkspacePath(directory, name)));
}

/**
 * Detects the single wrapper directory that ZIP tools add (`my-task/…`).
 * Returns "" when the package is already rooted at the task.
 */
export function stripNestedRoot(workspace: WorkspaceReader): string {
  const files = workspace.listFiles();
  const first = files[0];
  if (!first) {
    return "";
  }
  const top = first.split("/")[0];
  if (!top || !first.includes("/")) {
    return "";
  }
  const allNested = files.every((file) => file.startsWith(`${top}/`));
  if (!allNested || hasAnyMarker(workspace, "")) {
    return "";
  }
  return hasAnyMarker(workspace, top) || workspace.exists(joinWorkspacePath(top, "tasks"))
    ? top
    : "";
}

/**
 * Single discovery pass. Returns `tasks/<name>` roots for multi-task packages,
 * otherwise the package root (possibly the stripped wrapper directory).
 */
export function resolveTaskRoots(workspace: WorkspaceReader): readonly string[] {
  const prefix = stripNestedRoot(workspace);
  const tasksDirectory = joinWorkspacePath(prefix, TERMINUS_PATHS.tasksDirectory);
  const taskRoots = workspace
    .listDirectories(tasksDirectory)
    .filter((directory) => workspace.listFiles(directory).length > 0);

  return taskRoots.length > 0 ? [...taskRoots].sort() : [prefix];
}

export function taskExternalKey(taskRoot: string): string {
  const name = taskRoot.split("/").filter(Boolean).at(-1) ?? "task";
  return name.replaceAll(/[^a-zA-Z0-9._-]/g, "-").slice(0, 128) || "task";
}
