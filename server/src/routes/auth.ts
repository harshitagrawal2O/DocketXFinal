import { Router } from "express";
import { prisma } from "../db.js";
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
  requireAuth,
  sessionCookieOptions,
  type AuthedRequest,
} from "../auth/session.js";
import type { SessionUser } from "@docket/shared";

import { rateLimit } from "../middleware/rateLimit.js";

const COLORS = ["#4f46e5", "#059669", "#db2777", "#d97706", "#0891b2", "#7c3aed"];

export const authRouter = Router();

// Brute-force protection on credential endpoints.
const authLimit = rateLimit({ bucket: "auth", max: 10, windowMs: 15 * 60 * 1000 });
authRouter.post("/login", authLimit);
authRouter.post("/register", authLimit);

function toSessionUser(u: { id: string; name: string; email: string; color: string }): SessionUser {
  return { id: u.id, name: u.name, email: u.email, color: u.color };
}

function setSessionCookie(res: import("express").Response, token: string): void {
  res.cookie?.(SESSION_COOKIE, token, sessionCookieOptions());
}

authRouter.post("/register", async (req, res) => {
  const { email, name, password } = req.body ?? {};
  if (!email || !name || !password) return res.status(400).json({ error: "email, name, password required" });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });
  const count = await prisma.user.count();
  const user = await prisma.user.create({
    data: { email, name, passwordHash: hashPassword(password), color: COLORS[count % COLORS.length]! },
  });
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  return res.json(toSessionUser(user));
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  return res.json(toSessionUser(user));
});

authRouter.post("/logout", async (req, res) => {
  const cookie = req.header("cookie") ?? "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (match) await destroySession(decodeURIComponent(match[1]!));
  res.clearCookie?.(SESSION_COOKIE, { path: "/" });
  return res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  return res.json(toSessionUser(req.user!));
});
