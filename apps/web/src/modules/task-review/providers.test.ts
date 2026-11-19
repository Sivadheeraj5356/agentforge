import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  configuredReviewProviders,
  generateReviewJson,
} from "@/modules/task-review/server/providers";

const ORIGINAL_ENV = { ...process.env };

function clearProviderKeys(): void {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.GROQ_MODEL;
  delete process.env.OPENROUTER_MODEL;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function chatBody(text: string): unknown {
  return { choices: [{ message: { content: text } }] };
}

beforeEach(() => {
  clearProviderKeys();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("configuredReviewProviders", () => {
  it("lists only providers with keys", () => {
    process.env.GROQ_API_KEY = "gsk_test";
    expect(configuredReviewProviders()).toEqual(["groq"]);
  });
});

describe("generateReviewJson", () => {
  it("explains the missing configuration when no keys are set", async () => {
    const result = await generateReviewJson("prompt");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("GEMINI_API_KEY");
      expect(result.error).toContain("GROQ_API_KEY");
    }
  });

  it("falls back to Groq when Gemini fails", async () => {
    process.env.GEMINI_API_KEY = "gemini_key";
    process.env.GROQ_API_KEY = "gsk_test";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("generativelanguage.googleapis.com")) {
        return jsonResponse({ error: "quota" }, 429);
      }
      return jsonResponse(chatBody('{"summary":"ok"}'));
    });
    const result = await generateReviewJson("prompt");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe('{"summary":"ok"}');
      expect(result.model).toBe("llama-3.3-70b-versatile");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tries OpenRouter last and honors model overrides", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    process.env.OPENROUTER_API_KEY = "or_test";
    process.env.OPENROUTER_MODEL = "custom/model";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("groq.com")) {
        return jsonResponse({}, 500);
      }
      return jsonResponse(chatBody("review text"));
    });
    const result = await generateReviewJson("prompt");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model).toBe("custom/model");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports failure when every configured provider fails", async () => {
    process.env.GROQ_API_KEY = "gsk_test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, 503));
    const result = await generateReviewJson("prompt");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("All configured review providers failed");
    }
  });
});
