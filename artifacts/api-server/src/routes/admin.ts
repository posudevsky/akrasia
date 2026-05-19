import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, waitlistTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/admin/verify", (req, res): void => {
  const { password } = req.body as { password?: string };
  const adminPassword = process.env["ADMIN_PASSWORD"];

  if (!adminPassword || password !== adminPassword) {
    res.status(401).json({ error: "Неверный пароль" });
    return;
  }

  res.json({ ok: true });
});

router.get("/admin/waitlist", requireAdmin, async (req, res): Promise<void> => {
  try {
    const entries = await db.select().from(waitlistTable).orderBy(waitlistTable.createdAt);
    res.json({ entries: entries.map((e) => ({ id: e.id, email: e.email, createdAt: e.createdAt.toISOString() })) });
  } catch (err) {
    req.log.error({ err }, "Admin waitlist error");
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json({ users: users.map((u) => ({ id: u.id, email: u.email, createdAt: u.createdAt.toISOString() })) });
  } catch (err) {
    req.log.error({ err }, "Admin users error");
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email и пароль обязательны" });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(usersTable).values({ email: email.toLowerCase().trim(), passwordHash });
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      res.status(400).json({ error: "Пользователь с таким email уже существует" });
      return;
    }
    req.log.error({ err }, "Admin create user error");
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Неверный ID" });
    return;
  }

  try {
    const result = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
    if (result.length === 0) {
      res.status(404).json({ error: "Пользователь не найден" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete user error");
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
