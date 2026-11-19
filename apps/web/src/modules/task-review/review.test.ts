import { describe, expect, it } from "vitest";

import {
  buildReviewPrompt,
  parseTaskReview,
  type ReviewPromptInput,
} from "@/modules/task-review/server/review";

const baseInput: ReviewPromptInput = {
  taskName: "Fix the orders API",
  externalKey: "broken-orders-api",
  taskVersion: "1.0.0",
  instruction: "Diagnose the 500 on GET /orders without changing the contract.",
  manifestPaths: ["instruction.md", "solution.sh", "tests/test_outputs.py"],
  findings: [
    {
      code: "verifier-missing-file",
      severity: "error",
      category: "verifier",
      title: "Verifier references a missing file",
      message: "tests/test_outputs.py is referenced but not present.",
    },
  ],
};

const validReview = {
  summary: "The task asks the agent to fix a crashing orders endpoint.",
  difficulty: "medium",
  difficultyRationale: "Requires reading server logs and narrowing a regression.",
  strengths: ["Clear contract constraint"],
  issues: ["No explicit time budget"],
  suggestions: ["State the expected response shape"],
  readiness: {
    ready: true,
    missing: [],
    assessment: "The task is self-contained and fairly graded.",
  },
};

describe("buildReviewPrompt", () => {
  it("includes the instruction, manifest, and findings", () => {
    const prompt = buildReviewPrompt(baseInput);
    expect(prompt).toContain("Diagnose the 500 on GET /orders");
    expect(prompt).toContain("tests/test_outputs.py");
    expect(prompt).toContain("verifier-missing-file");
    expect(prompt).toContain("broken-orders-api");
  });

  it("notes a missing instruction instead of sending an empty block", () => {
    const prompt = buildReviewPrompt({ ...baseInput, instruction: null });
    expect(prompt).toContain("no instruction file was found");
  });

  it("caps the instruction length", () => {
    const prompt = buildReviewPrompt({ ...baseInput, instruction: "x".repeat(20000) });
    expect(prompt.length).toBeLessThan(12000);
  });
});

describe("parseTaskReview", () => {
  it("parses a plain JSON response", () => {
    const review = parseTaskReview(JSON.stringify(validReview));
    expect(review?.difficulty).toBe("medium");
    expect(review?.readiness.ready).toBe(true);
  });

  it("parses a fenced JSON response with surrounding prose", () => {
    const review = parseTaskReview(
      `Here is the review:\n\`\`\`json\n${JSON.stringify(validReview)}\n\`\`\``,
    );
    expect(review?.summary).toContain("orders endpoint");
  });

  it("rejects an unknown difficulty", () => {
    const review = parseTaskReview(JSON.stringify({ ...validReview, difficulty: "impossible" }));
    expect(review).toBeNull();
  });

  it("rejects non-JSON output", () => {
    expect(parseTaskReview("no review here")).toBeNull();
  });

  it("rejects a review without readiness", () => {
    const { readiness, ...rest } = validReview;
    void readiness;
    expect(parseTaskReview(JSON.stringify(rest))).toBeNull();
  });
});
