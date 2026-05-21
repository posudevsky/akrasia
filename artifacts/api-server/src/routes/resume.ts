import { Router, type IRouter } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { ANALYZE_PROMPT, ADAPT_PROMPT } from "../lib/prompts";
import { callYandexLLM } from "../lib/yandex";
import {
  AnalyzeResumeBody,
  AnalyzeResumeResponse,
  AdaptResumeBody,
  AdaptResumeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeResumeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { vacancyText, resumeText } = parsed.data;

  const prompt = ANALYZE_PROMPT
    .replace("{{vacancy_text}}", vacancyText)
    .replace("{{resume_text}}", resumeText);

  try {
    const rawJson = await callYandexLLM(prompt);
    const result = JSON.parse(rawJson) as { requirements: unknown[] };
    const validated = AnalyzeResumeResponse.safeParse(result);
    if (!validated.success) {
      req.log.error({ error: validated.error.message, rawJson }, "LLM returned invalid JSON structure for analyze");
      res.status(500).json({ error: "Не удалось разобрать ответ от LLM. Попробуйте ещё раз." });
      return;
    }
    res.json(validated.data);
  } catch (err) {
    req.log.error({ err }, "Error calling LLM for analyze");
    res.status(500).json({ error: "Ошибка при обращении к языковой модели. Попробуйте ещё раз." });
  }
});

router.post("/adapt", async (req, res): Promise<void> => {
  const parsed = AdaptResumeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { vacancyText, resumeText, userAnswers } = parsed.data;

  const answersText = userAnswers
    .filter((a) => a.answer && a.answer.trim())
    .map((a) => `Требование #${a.requirementId}: ${a.answer}`)
    .join("\n");

  const prompt = ADAPT_PROMPT
    .replace("{{vacancy_text}}", vacancyText)
    .replace("{{resume_text}}", resumeText)
    .replace("{{user_answers}}", answersText || "Нет дополнительных ответов");

  try {
    const rawJson = await callYandexLLM(prompt, 16384);
    const result = JSON.parse(rawJson) as { resume_updated?: string; resumeUpdated?: string };
    const resumeUpdated = result.resume_updated ?? result.resumeUpdated ?? "";
    const validated = AdaptResumeResponse.safeParse({ resumeUpdated });
    if (!validated.success) {
      req.log.error({ error: validated.error.message, rawJson }, "LLM returned invalid JSON structure for adapt");
      res.status(500).json({ error: "Не удалось разобрать ответ от LLM. Попробуйте ещё раз." });
      return;
    }
    res.json(validated.data);
  } catch (err) {
    req.log.error({ err }, "Error calling LLM for adapt");
    res.status(500).json({ error: "Ошибка при обращении к языковой модели. Попробуйте ещё раз." });
  }
});

function htmlToStructuredText(html: string): string {
  let text = html;

  // Headings → uppercase + double newline
  text = text.replace(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, (_m, inner) => {
    const content = inner.replace(/<[^>]+>/g, "").trim().toUpperCase();
    return content ? `\n${content}\n` : "";
  });

  // List items → "– " prefix
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => {
    const content = inner.replace(/<[^>]+>/g, "").trim();
    return content ? `– ${content}\n` : "";
  });

  // Paragraphs and block-level divs → newline after
  text = text.replace(/<\/(p|div|ul|ol|blockquote)>/gi, "\n");

  // Line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Collapse runs of 3+ newlines to 2
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim trailing spaces on each line
  text = text.split("\n").map((l) => l.trimEnd()).join("\n");

  return text.trim();
}

function normalizePdfText(raw: string): string {
  let text = raw;

  // Collapse runs of spaces/tabs (but preserve newlines)
  text = text.replace(/[ \t]{2,}/g, " ");

  // Collapse runs of 3+ newlines to 2
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim trailing spaces on each line
  text = text.split("\n").map((l) => l.trimEnd()).join("\n");

  return text.trim();
}

router.post("/parse-file", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Файл не загружен" });
    return;
  }

  const { mimetype, originalname, buffer } = req.file;
  const ext = (originalname ?? "").toLowerCase().split(".").pop();

  try {
    if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext === "docx") {
      const result = await mammoth.convertToHtml({ buffer });
      const text = htmlToStructuredText(result.value);
      res.json({ text });
      return;
    }

    if (mimetype === "application/pdf" || ext === "pdf") {
      // pdf-parse v1 is CommonJS — use createRequire to avoid bundler issues
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      res.json({ text: normalizePdfText(result.text) });
      return;
    }

    res.status(400).json({ error: "Поддерживаются только файлы PDF и DOCX" });
  } catch (err) {
    req.log.error({ err }, "Error parsing file");
    res.status(500).json({ error: "Не удалось извлечь текст из файла" });
  }
});

export default router;
