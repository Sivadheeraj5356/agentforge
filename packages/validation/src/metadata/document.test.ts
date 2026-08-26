import { describe, expect, it } from "vitest";

import { createMemoryWorkspace } from "../workspace/memory";
import { readTaskDocument, schemaIssuesUnder, withSchemaIssues } from "./document";
import { MetadataParseError } from "./errors";
import { parseTomlDocument } from "./toml";
import { parseYamlDocument } from "./yaml-lite";

describe("parseTomlDocument", () => {
  it("records the line of every key and table", () => {
    const document = parseTomlDocument(
      ['version = "1.0.0"', "", "[metadata]", 'author_name = "Ada"'].join("\n"),
    );
    expect(document.table).toEqual({ version: "1.0.0", metadata: { author_name: "Ada" } });
    expect(document.keyLines.get("version")).toBe(1);
    expect(document.keyLines.get("metadata")).toBe(3);
    expect(document.keyLines.get("metadata.author_name")).toBe(4);
  });

  it("carries the failing line on the parse error", () => {
    let thrown: unknown;
    try {
      parseTomlDocument('version = "1.0.0"\nthis is not = toml [[[[');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(MetadataParseError);
    expect((thrown as MetadataParseError).line).toBe(2);
  });
});

describe("parseYamlDocument", () => {
  it("records top-level key lines and block scalars", () => {
    const document = parseYamlDocument(
      ["author_name: Ada", "instruction: |", "  Write a file.", "  Then stop."].join("\n"),
    );
    expect(document.map.instruction).toBe("Write a file.\nThen stop.");
    expect(document.keyLines.get("instruction")).toBe(2);
  });

  it("rejects anchors, aliases, and merge keys", () => {
    expect(() => parseYamlDocument("base: &anchor\ninstruction: *anchor\n")).toThrow(/anchors/i);
  });
});

describe("readTaskDocument", () => {
  it("returns null when the document is absent", () => {
    const workspace = createMemoryWorkspace([{ path: "instruction.md", content: "hi" }]);
    expect(readTaskDocument(workspace, "task.toml")).toBeNull();
  });

  it("turns a parse failure into a parse issue with a real line number", () => {
    const workspace = createMemoryWorkspace([
      { path: "task.toml", content: 'version = "1"\nbroken [[[[\n' },
    ]);
    const document = readTaskDocument(workspace, "task.toml");
    expect(document?.issues).toHaveLength(1);
    expect(document?.issues[0]?.kind).toBe("parse");
    expect(document?.issues[0]?.location.line).toBe(2);
  });

  it("locates a field, falling back to its nearest declared ancestor", () => {
    const workspace = createMemoryWorkspace([
      { path: "task.toml", content: "[verifier]\ntimeout_sec = 10\n" },
    ]);
    const document = readTaskDocument(workspace, "task.toml");
    expect(document?.locate("verifier.timeout_sec")).toEqual({
      path: "task.toml",
      line: 2,
      fieldPath: "verifier.timeout_sec",
    });
    expect(document?.locate("verifier.environment_mode")).toEqual({
      path: "task.toml",
      line: 1,
      fieldPath: "verifier.environment_mode",
    });
    expect(document?.locate("absent")).toEqual({
      path: "task.toml",
      line: null,
      fieldPath: "absent",
    });
  });
});

describe("schema issues", () => {
  it("attaches issues to the owning section", () => {
    const workspace = createMemoryWorkspace([
      { path: "task.toml", content: "[environment]\ncpus = -1\n" },
    ]);
    const document = readTaskDocument(workspace, "task.toml");
    expect(document).not.toBeNull();
    const withIssues = withSchemaIssues(document!, [
      { fieldPath: "environment.cpus", message: "Number must be greater than 0" },
    ]);

    expect(schemaIssuesUnder(withIssues, "environment")).toHaveLength(1);
    expect(schemaIssuesUnder(withIssues, "verifier")).toHaveLength(0);
    expect(schemaIssuesUnder(withIssues, "environment")[0]?.location.line).toBe(2);
  });
});
