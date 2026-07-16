import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  color: string;
}

// In-memory session store (fine for pilot; swap for Redis/DB in production).
const sessions = new Map<string, string>(); // token -> userId
export const SESSION_COOKIE = "docket_session";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createSession(userId: string): string {
  const token = randomUUID();
  sessions.set(token, userId);
  return token;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("="));
  }
  return out;
}

async function resolveUser(req: Request): Promise<AuthedUser | null> {
  // Dev shortcut: x-user-id header.
  const devId = req.header("x-user-id");
  const cookies = parseCookies(req.header("cookie"));
  const token = cookies[SESSION_COOKIE];
  const userId = devId ?? (token ? sessions.get(token) : undefined);
  if (!userId) return null;
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, color: u.color };
}

export interface AuthedRequest extends Request {
  user?: AuthedUser;
}

export async function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  req.user = (await resolveUser(req)) ?? undefined;
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}
