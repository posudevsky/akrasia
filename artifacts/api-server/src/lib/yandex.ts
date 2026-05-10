const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;
const YANDEX_ENDPOINT = "https://llm.api.cloud.yandex.net/v1/chat/completions";
const YANDEX_MODEL = `gpt://${YANDEX_FOLDER_ID}/qwen3-235b-a22b-fp8/latest`;

export async function callYandexLLM(prompt: string): Promise<string> {
  if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
    throw new Error("YANDEX_API_KEY and YANDEX_FOLDER_ID must be set");
  }

  const response = await fetch(YANDEX_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${YANDEX_API_KEY}`,
      "x-folder-id": YANDEX_FOLDER_ID,
    },
    body: JSON.stringify({
      model: YANDEX_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Yandex LLM API error ${response.status}: ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from Yandex LLM");
  }

  // Strip <think>...</think> blocks if present (Qwen3 chain-of-thought)
  const stripped = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences if present
  const clean = stripped
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return clean;
}
