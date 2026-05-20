const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;
const YANDEX_ENDPOINT = "https://llm.api.cloud.yandex.net/v1/chat/completions";
const YANDEX_MODEL = `gpt://${YANDEX_FOLDER_ID}/qwen3-235b-a22b-fp8/latest`;

const TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;

async function callOnce(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(YANDEX_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Api-Key ${YANDEX_API_KEY}`,
        "x-folder-id": YANDEX_FOLDER_ID!,
      },
      body: JSON.stringify({
        model: YANDEX_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 8192,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Yandex LLM API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from Yandex LLM");
  }

  const stripped = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const clean = stripped
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return clean;
}

export async function callYandexLLM(prompt: string): Promise<string> {
  if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
    throw new Error("YANDEX_API_KEY and YANDEX_FOLDER_ID must be set");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callOnce(prompt);
    } catch (err) {
      lastError = err;
      const isRetryable =
        (err instanceof Error && err.name === "AbortError") ||
        (err instanceof Error && /API error (5\d\d)/.test(err.message));
      if (!isRetryable || attempt === MAX_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}
