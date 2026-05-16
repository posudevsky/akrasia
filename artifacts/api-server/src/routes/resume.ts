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
    const rawJson = await callYandexLLM(prompt);
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

router.post("/parse-file", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Файл не загружен" });
    return;
  }

  const { mimetype, originalname, buffer } = req.file;
  const ext = (originalname ?? "").toLowerCase().split(".").pop();

  try {
    if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      res.json({ text: result.value.trim() });
      return;
    }

    if (mimetype === "application/pdf" || ext === "pdf") {
      // pdf-parse v1 is CommonJS — use createRequire to avoid bundler issues
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      res.json({ text: result.text.trim() });
      return;
    }

    res.status(400).json({ error: "Поддерживаются только файлы PDF и DOCX" });
  } catch (err) {
    req.log.error({ err }, "Error parsing file");
    res.status(500).json({ error: "Не удалось извлечь текст из файла" });
  }
});

export default router;
