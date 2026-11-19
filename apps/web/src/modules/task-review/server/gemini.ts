const DEFAULT_MODEL = "gemini-3.8-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 30_000;

export type GeminiResult =
  | { readonly ok: true; readonly text: string; readonly model: string }
  | { readonly ok: false; readonly error: string };

type GeminiResponse = {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly { readonly text?: string }[];
    };
  }[];
};

export function geminiModelName(): string {
  const configured = process.env.GEMINI_MODEL;
  return configured && configured.trim().length > 0 ? configured.trim() : DEFAULT_MODEL;
}

export async function generateGeminiJson(prompt: string): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "No Gemini API key is configured on the server. Create a free key in Google AI Studio and set GEMINI_API_KEY in the app environment.",
    };
  }
  const model = geminiModelName();
  try {
    const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        detail = body.error?.message ?? "";
      } catch {
        detail = "";
      }
      const suffix = detail.length > 0 ? ` ${detail.slice(0, 160)}` : "";
      return {
        ok: false,
        error: `The review service answered with HTTP ${response.status}.${suffix}`,
      };
    }
    const payload = (await response.json()) as GeminiResponse;
    const text = (payload.candidates ?? [])
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (text.length === 0) {
      return { ok: false, error: "The review service returned an empty response." };
    }
    return { ok: true, text, model };
  } catch {
    return { ok: false, error: "The review request did not complete. Try again." };
  }
}
