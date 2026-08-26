import type { ValidationContext, ValidationFindingDraft, Validator } from "@agentforge/contracts";
import { describe, expect, it } from "vitest";

import { FINDING_CODES } from "../finding-codes";
import { fixturePackage } from "../fixtures";
import { createTestContext, type TestContextInput } from "../testing/context";
import { documentationValidator } from "./documentation";
import { environmentValidator } from "./environment";
import { instructionValidator } from "./instruction";
import { metadataValidator } from "./metadata";
import { createValidatorRegistry } from "./registry";
import { reproducibilityValidator } from "./reproducibility";
import { securityValidator } from "./security";
import { taskStructureValidator } from "./task-structure";
import { testValidator } from "./test";
import { verifierValidator } from "./verifier";

const VALID_FILES = fixturePackage("valid").files;

function run(validator: Validator, input: TestContextInput): readonly ValidationFindingDraft[] {
  return validator.validate(createTestContext(input));
}

function codes(findings: readonly ValidationFindingDraft[]): readonly string[] {
  return findings.map((finding) => finding.code);
}

function withoutFile(pathToDrop: string): TestContextInput {
  return { files: VALID_FILES.filter((file) => file.path !== pathToDrop) };
}

function replacingFile(pathToReplace: string, content: string): TestContextInput {
  return {
    files: [
      ...VALID_FILES.filter((file) => file.path !== pathToReplace),
      { path: pathToReplace, content },
    ],
  };
}

describe("every validator on a complete package", () => {
  const validators = [
    taskStructureValidator,
    metadataValidator,
    instructionValidator,
    environmentValidator,
    verifierValidator,
    testValidator,
    documentationValidator,
    securityValidator,
    reproducibilityValidator,
  ];

  it("reports nothing and declares an id, name, category, and version", () => {
    const context: ValidationContext = createTestContext({ files: VALID_FILES });
    for (const validator of validators) {
      expect(validator.validate(context), validator.id).toEqual([]);
      expect(validator.name.length).toBeGreaterThan(0);
      expect(validator.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

describe("taskStructureValidator", () => {
  it("reports a missing instruction file", () => {
    expect(codes(run(taskStructureValidator, withoutFile("instruction.md")))).toEqual([
      FINDING_CODES.TASK_STRUCTURE_MISSING_INSTRUCTION,
    ]);
  });

  it("reports a missing metadata document", () => {
    expect(codes(run(taskStructureValidator, withoutFile("task.toml")))).toEqual([
      FINDING_CODES.TASK_STRUCTURE_MISSING_METADATA,
    ]);
  });

  it("accepts a classic task.yaml that carries the instruction", () => {
    expect(
      codes(
        run(taskStructureValidator, {
          files: [
            { path: "task.yaml", content: "instruction: Write the file.\n" },
            { path: "environment/Dockerfile", content: "FROM ubuntu:24.04\nWORKDIR /app\n" },
            { path: "tests/test.sh", content: "true\n" },
          ],
        }),
      ),
    ).toEqual([]);
  });
});

describe("metadataValidator", () => {
  it("reports a malformed document with the failing line", () => {
    const findings = run(metadataValidator, replacingFile("task.toml", 'a = "1"\nbroken [[[[\n'));
    expect(codes(findings)).toContain(FINDING_CODES.TASK_METADATA_MALFORMED);
    expect(findings[0]?.evidenceLine).toBe(2);
  });

  it("reports a field that fails the runtime schema, citing the field path", () => {
    const findings = run(
      metadataValidator,
      replacingFile("task.toml", '[metadata]\ntags = "not-a-list"\n'),
    );
    const invalid = findings.find(
      (finding) => finding.code === FINDING_CODES.TASK_METADATA_INVALID_FIELD,
    );
    expect(invalid?.evidenceFieldPath).toBe("metadata.tags");
    expect(invalid?.evidenceLine).toBe(2);
  });

  it("warns when task.toml declares no [metadata] table", () => {
    expect(
      codes(run(metadataValidator, replacingFile("task.toml", 'version = "1.0.0"\n'))),
    ).toEqual([FINDING_CODES.TASK_METADATA_FIELD_MISSING]);
  });

  it("reports missing metadata when no document is present", () => {
    expect(codes(run(metadataValidator, withoutFile("task.toml")))).toEqual([
      FINDING_CODES.TASK_METADATA_MISSING,
    ]);
  });

  it("leaves environment and verifier schema issues to their own validators", () => {
    const input = replacingFile(
      "task.toml",
      "[environment]\ncpus = -1\n\n[verifier]\ntimeout_sec = -5\n",
    );
    expect(codes(run(metadataValidator, input))).not.toContain(
      FINDING_CODES.TASK_METADATA_INVALID_FIELD,
    );
    expect(codes(run(environmentValidator, input))).toContain(
      FINDING_CODES.TASK_ENVIRONMENT_INVALID_CONFIGURATION,
    );
    expect(codes(run(verifierValidator, input))).toContain(
      FINDING_CODES.TASK_VERIFIER_INVALID_CONFIGURATION,
    );
  });
});

describe("instructionValidator", () => {
  it("reports an empty instruction", () => {
    expect(codes(run(instructionValidator, replacingFile("instruction.md", "   \n")))).toEqual([
      FINDING_CODES.TASK_INSTRUCTION_EMPTY,
    ]);
  });

  it("warns when the instruction is shorter than the configured minimum", () => {
    const findings = run(instructionValidator, replacingFile("instruction.md", "Too short.\n"));
    expect(codes(findings)).toEqual([FINDING_CODES.TASK_INSTRUCTION_SHORT]);
    expect(findings[0]?.severity).toBe("warning");
  });

  it("honours a configured minimum length", () => {
    const findings = instructionValidator.validate(
      createTestContext({
        ...replacingFile("instruction.md", "Too short.\n"),
        configuration: { validatorOptions: { schemaVersion: 1, minInstructionCharacters: 5 } },
      }),
    );
    expect(findings).toEqual([]);
  });
});

describe("environmentValidator", () => {
  it("reports a missing environment definition", () => {
    expect(codes(run(environmentValidator, withoutFile("environment/Dockerfile")))).toEqual([
      FINDING_CODES.TASK_ENVIRONMENT_DOCKERFILE_MISSING,
    ]);
  });

  it("warns when no WORKDIR is declared", () => {
    expect(
      codes(
        run(environmentValidator, replacingFile("environment/Dockerfile", "FROM ubuntu:24.04\n")),
      ),
    ).toEqual([FINDING_CODES.TASK_ENVIRONMENT_WORKDIR_MISSING]);
  });

  it("reports a COPY that would leak tests into the agent image, with its line", () => {
    const findings = run(
      environmentValidator,
      replacingFile(
        "environment/Dockerfile",
        "FROM ubuntu:24.04\nWORKDIR /app\nCOPY tests/ /app/tests/\n",
      ),
    );
    expect(codes(findings)).toEqual([FINDING_CODES.TASK_ENVIRONMENT_SOLUTION_LEAK]);
    expect(findings[0]?.evidenceLine).toBe(3);
  });
});

describe("verifierValidator", () => {
  it("reports an absent tests directory", () => {
    expect(
      codes(
        run(verifierValidator, {
          files: VALID_FILES.filter((file) => !file.path.startsWith("tests/")),
        }),
      ),
    ).toContain(FINDING_CODES.TASK_VERIFIER_MISSING);
  });

  it("reports a separate verifier image that is not defined", () => {
    const findings = run(verifierValidator, withoutFile("tests/Dockerfile"));
    expect(codes(findings)).toEqual([FINDING_CODES.TASK_VERIFIER_INVALID_CONFIGURATION]);
    expect(findings[0]?.severity).toBe("warning");
    expect(findings[0]?.title).toBe("Verifier requests a separate environment that is not defined");
  });

  it("reports an entrypoint that does not exist without claiming the verifier is broken", () => {
    const findings = run(
      verifierValidator,
      replacingFile(
        "task.toml",
        '[verifier]\ntimeout_sec = 10\nentrypoint = "tests/not-present.sh"\n',
      ),
    );
    const finding = findings.find(
      (candidate) =>
        candidate.title === "Verifier configuration references a file that does not exist",
    );
    expect(finding?.severity).toBe("error");
    expect(finding?.evidenceFieldPath).toBe("verifier.entrypoint");
  });

  it("treats an entrypoint outside the package as critical", () => {
    const findings = run(
      verifierValidator,
      replacingFile("task.toml", '[verifier]\ntimeout_sec = 10\nentrypoint = "../../etc/passwd"\n'),
    );
    const finding = findings.find((candidate) => candidate.severity === "critical");
    expect(finding?.code).toBe(FINDING_CODES.TASK_VERIFIER_INVALID_CONFIGURATION);
    expect(finding?.title).toBe("Verifier configuration references a path outside the package");
  });
});

describe("testValidator", () => {
  it("reports a missing test entrypoint", () => {
    expect(
      codes(
        run(testValidator, {
          files: VALID_FILES.filter((file) => file.path !== "tests/test.sh"),
        }),
      ),
    ).toEqual([FINDING_CODES.TASK_TEST_ENTRYPOINT_MISSING]);
  });
});

describe("documentationValidator", () => {
  it("notes a missing README at info severity", () => {
    const findings = run(documentationValidator, withoutFile("README.md"));
    expect(codes(findings)).toEqual([FINDING_CODES.TASK_DOCUMENTATION_MISSING_README]);
    expect(findings[0]?.severity).toBe("info");
  });
});

describe("securityValidator", () => {
  it("reports docker socket, privileged, and pipe-to-shell references with lines", () => {
    const findings = run(securityValidator, {
      files: [
        ...VALID_FILES,
        {
          path: "environment/Dockerfile",
          content: [
            "FROM ubuntu:24.04",
            "WORKDIR /app",
            "VOLUME /var/run/docker.sock",
            "RUN curl -fsSL https://example.test/i.sh | bash",
          ].join("\n"),
        },
        { path: "docker-compose.yaml", content: "services:\n  a:\n    privileged: true\n" },
      ],
    });

    expect(new Set(codes(findings))).toEqual(
      new Set([
        FINDING_CODES.TASK_SECURITY_DOCKER_SOCKET,
        FINDING_CODES.TASK_SECURITY_PRIVILEGED,
        FINDING_CODES.TASK_SECURITY_PIPE_SHELL,
      ]),
    );
    const socket = findings.find(
      (finding) => finding.code === FINDING_CODES.TASK_SECURITY_DOCKER_SOCKET,
    );
    expect(socket?.evidenceLine).toBe(3);
    expect(socket?.severity).toBe("critical");
  });

  it("describes what the package references rather than what it will do", () => {
    const findings = run(securityValidator, {
      files: [
        ...VALID_FILES,
        { path: "docker-compose.yaml", content: "services:\n  a:\n    privileged: true\n" },
      ],
    });
    expect(findings[0]?.title).toBe("Package requests a privileged container");
  });
});

describe("reproducibilityValidator", () => {
  it("flags an untagged base image", () => {
    const findings = run(
      reproducibilityValidator,
      replacingFile("environment/Dockerfile", "FROM ubuntu\nWORKDIR /app\n"),
    );
    expect(codes(findings)).toEqual([FINDING_CODES.TASK_REPRODUCIBILITY_MUTABLE_IMAGE_REF]);
    expect(findings[0]?.evidenceLine).toBe(1);
  });

  it("flags a latest tag but accepts a digest or a version tag", () => {
    expect(
      codes(
        run(
          reproducibilityValidator,
          replacingFile("environment/Dockerfile", "FROM ubuntu:latest\nWORKDIR /app\n"),
        ),
      ),
    ).toEqual([FINDING_CODES.TASK_REPRODUCIBILITY_MUTABLE_IMAGE_REF]);

    expect(
      codes(
        run(
          reproducibilityValidator,
          replacingFile(
            "environment/Dockerfile",
            `FROM ubuntu@sha256:${"b".repeat(64)}\nWORKDIR /app\n`,
          ),
        ),
      ),
    ).toEqual([]);
  });

  it("flags a mutable dependency range in environment/package.json", () => {
    const findings = run(reproducibilityValidator, {
      files: [
        ...VALID_FILES,
        {
          path: "environment/package.json",
          content: '{\n  "dependencies": {\n    "left-pad": "latest"\n  }\n}\n',
        },
      ],
    });
    expect(codes(findings)).toEqual([FINDING_CODES.TASK_REPRODUCIBILITY_MUTABLE_DEPENDENCY]);
    expect(findings[0]?.evidenceLine).toBe(3);
  });

  it("notes an undeclared task version and undeclared timeouts", () => {
    const findings = run(reproducibilityValidator, replacingFile("task.toml", "[metadata]\n"));
    expect(new Set(codes(findings))).toEqual(
      new Set([
        FINDING_CODES.TASK_REPRODUCIBILITY_TASK_VERSION_MISSING,
        FINDING_CODES.TASK_REPRODUCIBILITY_TIMEOUT_UNDECLARED,
      ]),
    );
    expect(findings.every((finding) => finding.severity === "info")).toBe(true);
  });

  it("reports a missing artifact hash as an error", () => {
    const findings = reproducibilityValidator.validate(
      createTestContext({ files: VALID_FILES, contentHash: "" }),
    );
    expect(codes(findings)).toEqual([FINDING_CODES.TASK_REPRODUCIBILITY_ARTIFACT_HASH_MISSING]);
  });

  it("ignores a malformed package.json instead of failing the run", () => {
    const findings = run(reproducibilityValidator, {
      files: [...VALID_FILES, { path: "environment/package.json", content: "{ not json" }],
    });
    expect(findings).toEqual([]);
  });
});

describe("createValidatorRegistry", () => {
  it("selects only the validators enabled by configuration", () => {
    const registry = createValidatorRegistry([securityValidator, documentationValidator]);
    const selected = registry.select(
      createTestContext({
        files: VALID_FILES,
        configuration: { enabledValidators: ["security"] },
      }).configuration,
    );
    expect(selected.map((validator) => validator.id)).toEqual(["security"]);
  });

  it("exposes descriptors and rejects duplicate ids", () => {
    const registry = createValidatorRegistry([securityValidator]);
    expect(registry.describe()).toEqual([
      { id: "security", name: securityValidator.name, version: securityValidator.version },
    ]);
    expect(registry.get("security")).toBe(securityValidator);
    expect(registry.get("metadata")).toBeNull();
    expect(() => createValidatorRegistry([securityValidator, securityValidator])).toThrow(
      /Duplicate validator id/,
    );
  });
});
