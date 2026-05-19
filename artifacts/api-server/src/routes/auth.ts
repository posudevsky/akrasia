import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable, waitlistTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email и пароль обязательны" });
    return;
  }

  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    res.status(500).json({ error: "Сервер не настроен" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);

    if (!user) {
      res.status(401).json({ error: "Неверный email или пароль" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Неверный email или пароль" });
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: "30d" });

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({ id: user.id, email: user.email });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/auth/logout", (_req, res): void => {
  res.clearCookie("auth_token");
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const token = req.cookies?.["auth_token"] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Не авторизован" });
    return;
  }

  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    res.status(500).json({ error: "Сервер не настроен" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { userId: number; email: string };
    res.json({ id: payload.userId, email: payload.email });
  } catch {
    res.status(401).json({ error: "Сессия истекла" });
  }
});

router.post("/auth/waitlist", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };

  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Укажите корректный email" });
    return;
  }

  try {
    await db.insert(waitlistTable).values({ email: email.toLowerCase().trim() }).onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Waitlist error");
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
