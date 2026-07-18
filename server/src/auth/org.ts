import type { Response, NextFunction } from "express";
import { prisma } from "../db.js";
import { getTenantClient } from "../tenantDb.js";
import type { AuthedRequest } from "./session.js";

/**
 * Resolves the authenticated user's organization and attaches both the org
 * summary (for org-admin checks) and a PrismaClient pointed at that org's
 * OWN database (for every data-plane query downstream — documents,
 * proposals, audit, etc.). Runs on every request right after attachUser;
 * a user with no organization yet (mid-registration edge case) simply gets
 * neither field set, and requireTenantDb/requireOrgAdmin below 4xx as needed.
 */
export async function attachOrg(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) return next();
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { organization: true },
    });
    if (user?.organization) {
      req.org = {
        id: user.organization.id,
        name: user.organization.name,
        role: (user.orgRole as "admin" | "member") ?? "member",
      };
      req.tenantDb = getTenantClient({ id: user.organization.id, databaseUrlEnc: user.organization.databaseUrlEnc });
    }
  } catch (err) {
    // Same posture as attachUser: a transient DB error degrades to "no org
    // resolved for this request" rather than crashing the whole server.
    console.error("[org] attachOrg failed:", (err as Error).message);
  }
  next();
}

export function requireTenantDb(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.tenantDb) {
    res.status(403).json({ error: "You are not part of an organization yet." });
    return;
  }
  next();
}

export function requireOrgAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.org) {
    res.status(403).json({ error: "You are not part of an organization yet." });
    return;
  }
  if (req.org.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

/**
 * The user IDs belonging to one organization (control-plane lookup). Needed
 * anywhere a tenant-plane query would otherwise scan an ENTIRE tenant table
 * with no per-org filter — organizations that haven't set their own
 * dedicated database (see tenantDb.ts) share the platform's default
 * database, so an unscoped query there would silently return every OTHER
 * org's rows too. Always intersect with this list in that situation.
 */
export async function getOrgUserIds(organizationId: string): Promise<string[]> {
  const users = await prisma.user.findMany({ where: { organizationId }, select: { id: true } });
  return users.map((u) => u.id);
}

/** Blocks starting a NEW LLM-costing action once the org's credit balance is at or below zero (checked at start, not mid-stream — see usage.ts's recordUsage for the deduction side). */
export async function requireCredits(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.org) {
    res.status(403).json({ error: "You are not part of an organization yet." });
    return;
  }
  const org = await prisma.organization.findUnique({ where: { id: req.org.id }, select: { creditBalanceTokens: true } });
  if (org && org.creditBalanceTokens <= 0) {
    res.status(402).json({
      error: "Your organization is out of credits. Ask an admin to top up in the Admin portal.",
      code: "out_of_credits",
    });
    return;
  }
  next();
}
