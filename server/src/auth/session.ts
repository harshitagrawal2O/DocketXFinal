import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db.js";

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  color: string;
}

export const SESSION_COOKIE = "docket_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const IS_PROD = process.env.NODE_ENV === "production";
/** The x-user-id dev shortcut is disabled in production for security. */
const DEV_AUTH_ENABLED = !IS_PROD;

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

export async function createSession(userId: string): Promise<string> {
  const token = randomUUID();
  await prisma.session.create({
    data: { token, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

/** Cookie options — Secure + SameSite in production. */
export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: IS_PROD ? "strict" : "lax",
    secure: IS_PROD,
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
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
  // Dev shortcut: x-user-id header — DISABLED in production.
  const devId = DEV_AUTH_ENABLED ? req.header("x-user-id") : undefined;
  let userId: string | undefined = devId ?? undefined;

  if (!userId) {
    const cookies = parseCookies(req.header("cookie"));
    const token = cookies[SESSION_COOKIE];
    if (token) {
      const session = await prisma.session.findUnique({ where: { token } });
      if (session && session.expiresAt > new Date()) userId = session.userId;
      else if (session) await prisma.session.deleteMany({ where: { token } }); // expired: clean up
    }
  }

  if (!userId) return null;
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, color: u.color };
}

export interface AuthedOrg {
  id: string;
  name: string;
  role: "admin" | "member";
}

export interface AuthedRequest extends Request {
  user?: AuthedUser;
  /** Set by attachOrg (server/src/auth/org.ts), which always runs right after attachUser. */
  org?: AuthedOrg;
  /** A PrismaClient pointed at THIS request's organization's own database — see server/src/tenantDb.ts. */
  tenantDb?: import("@prisma/client").PrismaClient;
}

export async function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  // This runs on EVERY request. A transient DB error (e.g. a serverless
  // Postgres cold start) must not crash the whole server for every connected
  // user — treat it as "unauthenticated for this request" and move on;
  // downstream requireAuth/requireCap will 401/403 as appropriate.
  try {
    req.user = (await resolveUser(req)) ?? undefined;
  } catch (err) {
    console.error("[auth] attachUser failed:", (err as Error).message);
    req.user = undefined;
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}
