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
import type { Organization, User } from "@prisma/client";

import { rateLimit } from "../middleware/rateLimit.js";

const COLORS = ["#4f46e5", "#059669", "#db2777", "#d97706", "#0891b2", "#7c3aed"];

export const authRouter = Router();

// Brute-force protection on credential endpoints.
const authLimit = rateLimit({ bucket: "auth", max: 10, windowMs: 15 * 60 * 1000 });
authRouter.post("/login", authLimit);
authRouter.post("/register", authLimit);

function toSessionUser(u: User & { organization: Organization | null }): SessionUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    color: u.color,
    organizationId: u.organizationId,
    organizationName: u.organization?.name ?? null,
    orgRole: (u.orgRole as "admin" | "member" | null) ?? null,
  };
}

function setSessionCookie(res: import("express").Response, token: string): void {
  res.cookie?.(SESSION_COOKIE, token, sessionCookieOptions());
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "firm";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

authRouter.post("/register", async (req, res) => {
  const { email, name, password, inviteToken } = req.body ?? {};
  if (!email || !name || !password) return res.status(400).json({ error: "email, name, password required" });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });
  const count = await prisma.user.count();

  // Accepting an invite joins that organization as the invited role; a plain
  // signup (no invite) bootstraps a BRAND NEW organization with this user as
  // its sole admin — "one organization per new signup," consistent members
  // are added afterward via admin-issued invites.
  let organizationId: string;
  let orgRole: "admin" | "member";
  let invite: { id: string } | null = null;
  if (inviteToken) {
    const inv = await prisma.invite.findUnique({ where: { token: inviteToken } });
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
      return res.status(400).json({ error: "This invite link is invalid or has expired." });
    }
    if (inv.email.toLowerCase() !== String(email).toLowerCase()) {
      return res.status(400).json({ error: "This invite was issued to a different email address." });
    }
    organizationId = inv.organizationId;
    orgRole = inv.role as "admin" | "member";
    invite = { id: inv.id };
  } else {
    const org = await prisma.organization.create({ data: { name: `${name}'s Firm`, slug: slugify(name) } });
    organizationId = org.id;
    orgRole = "admin";
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hashPassword(password),
      color: COLORS[count % COLORS.length]!,
      organizationId,
      orgRole,
    },
    include: { organization: true },
  });
  if (invite) await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  return res.json(toSessionUser(user));
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await prisma.user.findUnique({ where: { email }, include: { organization: true } });
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

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: { organization: true } });
  return res.json(toSessionUser(user));
});
