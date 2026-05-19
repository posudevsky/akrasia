import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { adaptationsTable } from "@workspace/db/schema";
import { and, eq, desc, notInArray } from "drizzle-orm";
import { CreateHistoryBody } from "@workspace/api-zod";

const HISTORY_LIMIT = 5;

const router: IRouter = Router();

router.post("/history", async (req, res): Promise<void> => {
  const parsed = CreateHistoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.userId;
  const { vacancyText, resumeText, adaptedResume, matchScore } = parsed.data;
  const vacancySnippet = vacancyText.slice(0, 80);

  try {
    const [row] = await db
      .insert(adaptationsTable)
      .values({ userId, vacancySnippet, vacancyText, resumeText, adaptedResume, matchScore })
      .returning();

    if (!row) {
      res.status(500).json({ error: "Не удалось сохранить запись" });
      return;
    }

    // Keep only the HISTORY_LIMIT most recent records for this user
    const recent = await db
      .select({ id: adaptationsTable.id })
      .from(adaptationsTable)
      .where(eq(adaptationsTable.userId, userId))
      .orderBy(desc(adaptationsTable.createdAt))
      .limit(HISTORY_LIMIT);

    const keepIds = recent.map((r) => r.id);
    if (keepIds.length === HISTORY_LIMIT) {
      await db
        .delete(adaptationsTable)
        .where(and(eq(adaptationsTable.userId, userId), notInArray(adaptationsTable.id, keepIds)));
    }

    res.json({
      id: row.id,
      vacancySnippet: row.vacancySnippet,
      matchScore: row.matchScore,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error saving history");
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.get("/history", async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  try {
    const rows = await db
      .select({
        id: adaptationsTable.id,
        vacancySnippet: adaptationsTable.vacancySnippet,
        matchScore: adaptationsTable.matchScore,
        createdAt: adaptationsTable.createdAt,
      })
      .from(adaptationsTable)
      .where(eq(adaptationsTable.userId, userId))
      .orderBy(desc(adaptationsTable.createdAt))
      .limit(HISTORY_LIMIT);

    res.json({
      entries: rows.map((r) => ({
        id: r.id,
        vacancySnippet: r.vacancySnippet,
        matchScore: r.matchScore,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching history");
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.get("/history/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params["id"] ?? "", 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Неверный идентификатор" });
    return;
  }

  try {
    const [row] = await db
      .select()
      .from(adaptationsTable)
      .where(eq(adaptationsTable.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Запись не найдена" });
      return;
    }

    if (row.userId !== userId) {
      res.status(404).json({ error: "Запись не найдена" });
      return;
    }

    res.json({
      id: row.id,
      vacancySnippet: row.vacancySnippet,
      vacancyText: row.vacancyText,
      resumeText: row.resumeText,
      adaptedResume: row.adaptedResume,
      matchScore: row.matchScore,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching history entry");
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/history/:id", async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = parseInt(req.params["id"] ?? "", 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Неверный идентификатор" });
    return;
  }

  try {
    const [row] = await db
      .select({ id: adaptationsTable.id, userId: adaptationsTable.userId })
      .from(adaptationsTable)
      .where(eq(adaptationsTable.id, id))
      .limit(1);

    if (!row || row.userId !== userId) {
      res.status(404).json({ error: "Запись не найдена" });
      return;
    }

    await db.delete(adaptationsTable).where(eq(adaptationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting history entry");
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
