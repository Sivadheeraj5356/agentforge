import { describe, expect, it } from "vitest";

import { detectLanguage, tokenizeLine } from "@/modules/tasks/highlight";

function concatenated(line: string, language: Parameters<typeof tokenizeLine>[1]): string {
  return tokenizeLine(line, language)
    .map((token) => token.text)
    .join("");
}

describe("detectLanguage", () => {
  it("recognizes the file types a task package actually contains", () => {
    expect(detectLanguage("environment/Dockerfile")).toBe("dockerfile");
    expect(detectLanguage("DOCKERFILE")).toBe("dockerfile");
    expect(detectLanguage("tests/test.sh")).toBe("shell");
    expect(detectLanguage("task.toml")).toBe("toml");
    expect(detectLanguage("docker-compose.yml")).toBe("yaml");
    expect(detectLanguage("environment/package.json")).toBe("json");
    expect(detectLanguage("tests/test_outputs.py")).toBe("python");
    expect(detectLanguage("instruction.md")).toBe("markdown");
    expect(detectLanguage("data.bin")).toBe("plain");
    expect(detectLanguage("LICENSE")).toBe("plain");
  });
});

describe("tokenizeLine", () => {
  it("never loses or invents characters", () => {
    const lines = [
      "FROM ubuntu:22.04 # base",
      'name = "fix-build"',
      "if [ -f solution.sh ]; then echo 'leak'; fi",
      '{"scripts": {"test": "pytest"}}',
      "",
      "   ",
      "λ → ünïcode ✓",
    ];
    for (const line of lines) {
      expect(concatenated(line, "shell")).toBe(line);
      expect(concatenated(line, "dockerfile")).toBe(line);
      expect(concatenated(line, "toml")).toBe(line);
      expect(concatenated(line, "plain")).toBe(line);
    }
  });

  it("marks Dockerfile instructions regardless of case", () => {
    expect(tokenizeLine("FROM ubuntu:22.04", "dockerfile")[0]).toEqual({
      kind: "keyword",
      text: "FROM",
    });
    expect(tokenizeLine("workdir /app", "dockerfile")[0]).toEqual({
      kind: "keyword",
      text: "workdir",
    });
  });

  it("marks comments to end of line and does not tokenize inside them", () => {
    const tokens = tokenizeLine("RUN apt-get update # then 'quote and \"quote", "dockerfile");
    expect(tokens.at(-1)).toEqual({
      kind: "comment",
      text: "# then 'quote and \"quote",
    });
    expect(tokens.filter((token) => token.kind === "string")).toEqual([]);
  });

  it("marks strings, including escaped quotes and unterminated ones", () => {
    expect(tokenizeLine('a = "one \\" two"', "toml")).toContainEqual({
      kind: "string",
      text: '"one \\" two"',
    });
    expect(tokenizeLine('a = "never closed', "toml")).toContainEqual({
      kind: "string",
      text: '"never closed',
    });
  });

  it("marks the key half of a key/value line", () => {
    expect(tokenizeLine("max_agent_timeout_sec = 300", "toml")[0]).toEqual({
      kind: "key",
      text: "max_agent_timeout_sec",
    });
    expect(tokenizeLine("  image: python:3.11", "yaml")[0]).toEqual({
      kind: "key",
      text: "  image",
    });
  });

  it("marks numbers only when the whole word is numeric", () => {
    const tokens = tokenizeLine("timeout = 300", "toml");
    expect(tokens).toContainEqual({ kind: "number", text: "300" });
    expect(tokenizeLine("v1.2.3-beta", "plain")).toEqual([{ kind: "plain", text: "v1.2.3-beta" }]);
  });

  it("treats markup as ordinary characters", () => {
    const line = '<img src=x onerror="alert(1)">';
    const tokens = tokenizeLine(line, "markdown");
    expect(tokens.map((token) => token.text).join("")).toBe(line);
    expect(tokens.every((token) => typeof token.text === "string")).toBe(true);
  });
});
