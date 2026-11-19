import { generateGeminiJson } from "./gemini";

export type ProviderResult =
  | { readonly ok: true; readonly text: string; readonly model: string }
  | { readonly ok: false; readonly error: string };

type ChatCompletionResponse = {
  readonly choices?: readonly {
    readonly message?: { readonly content?: string };
  }[];
};

const REQUEST_TIMEOUT_MS = 55_000;

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_DEFAULT_MODEL = "google/gemma-4-31b-it:free";

function envModel(name: string, fallback: string): string {
  const configured = process.env[name];
  return configured && configured.trim().length > 0 ? configured.trim() : fallback;
}

async function callChatCompletions(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string,
): Promise<ProviderResult> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    const payload = (await response.json()) as ChatCompletionResponse;
    const text = (payload.choices ?? [])
      .map((choice) => choice.message?.content ?? "")
      .join("")
      .trim();
    if (text.length === 0) {
      return { ok: false, error: "empty response" };
    }
    return { ok: true, text, model };
  } catch {
    return { ok: false, error: "request did not complete" };
  }
}

export function configuredReviewProviders(): string[] {
  const providers: string[] = [];
  if (process.env.GEMINI_API_KEY) {
    providers.push("gemini");
  }
  if (process.env.GROQ_API_KEY) {
    providers.push("groq");
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push("openrouter");
  }
  return providers;
}

export async function generateReviewJson(prompt: string): Promise<ProviderResult> {
  const attempts: { name: string; run: () => Promise<ProviderResult> }[] = [];
  if (process.env.GEMINI_API_KEY) {
    attempts.push({ name: "gemini", run: () => generateGeminiJson(prompt) });
  }
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    attempts.push({
      name: "groq",
      run: () =>
        callChatCompletions(
          GROQ_ENDPOINT,
          groqKey,
          envModel("GROQ_MODEL", GROQ_DEFAULT_MODEL),
          prompt,
        ),
    });
  }
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    attempts.push({
      name: "openrouter",
      run: () =>
        callChatCompletions(
          OPENROUTER_ENDPOINT,
          openRouterKey,
          envModel("OPENROUTER_MODEL", OPENROUTER_DEFAULT_MODEL),
          prompt,
        ),
    });
  }
  if (attempts.length === 0) {
    return {
      ok: false,
      error:
        "No review provider key is configured on the server. Set one of GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY in the app environment; all three have free tiers.",
    };
  }
  const failures: string[] = [];
  for (const { name, run } of attempts) {
    const result = await run();
    if (result.ok) {
      return result;
    }
    failures.push(`${name}: ${result.error}`);
  }
  return {
    ok: false,
    error: `All configured review providers failed (${failures.join("; ")}). Try again in a moment.`,
  };
}
