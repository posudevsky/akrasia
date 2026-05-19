import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface AuthPayload {
  userId: number;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.["auth_token"] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Необходима авторизация" });
    return;
  }

  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    res.status(500).json({ error: "Сервер не настроен" });
    return;
  }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, secret) as AuthPayload;
  } catch {
    res.status(401).json({ error: "Сессия истекла, войдите снова" });
    return;
  }

  db.select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1)
    .then(([user]) => {
      if (!user) {
        res.clearCookie("auth_token");
        res.status(401).json({ error: "Пользователь не найден" });
        return;
      }
      req.user = payload;
      next();
    })
    .catch((err: unknown) => {
      req.log.error({ err }, "requireAuth DB lookup failed");
      res.status(500).json({ error: "Ошибка сервера" });
    });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminPassword = process.env["ADMIN_PASSWORD"];
  const provided = req.headers["x-admin-password"];
  if (!adminPassword || provided !== adminPassword) {
    res.status(401).json({ error: "Неверный пароль администратора" });
    return;
  }
  next();
}
