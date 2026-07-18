import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
import { requireOrgAdmin, requireTenantDb, getOrgUserIds } from "../auth/org.js";
import { encryptSecret, decryptSecret, maskSecretHint } from "../util/crypto.js";
import { provisionTenantDatabase } from "../admin/tenantProvisioning.js";
import { createId } from "../util/id.js";
import { rateLimit } from "../middleware/rateLimit.js";
import type {
  OrganizationDTO,
  OrgMemberDTO,
  InviteDTO,
  CreateInviteRequest,
  UpdateOrgProfileRequest,
  SetApiKeyRequest,
  SetDatabaseRequest,
  AddCreditsRequest,
  UpdateMemberRoleRequest,
  AdminUsageSummary,
  UsageDayPoint,
  UsageByKind,
  UsageByUser,
} from "@docket/shared";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireOrgAdmin);

/** 1 credit = 1000 tokens (input+output) — see usage.ts's recordUsage, which deducts raw tokens. */
const CREDIT_TOKEN_SCALE = 1000;
const secretsLimit = rateLimit({ bucket: "admin-secrets", max: 10, windowMs: 60 * 1000 });

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  anthropicApiKeyEnc: string | null;
  databaseUrlEnc: string | null;
  creditBalanceTokens: number;
}

function toOrgDTO(org: OrgRow): OrganizationDTO {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    hasOwnApiKey: Boolean(org.anthropicApiKeyEnc),
    apiKeyHint: org.anthropicApiKeyEnc ? maskSecretHint(decryptSecret(org.anthropicApiKeyEnc)) : null,
    hasOwnDatabase: Boolean(org.databaseUrlEnc),
    databaseHint: org.databaseUrlEnc ? maskSecretHint(decryptSecret(org.databaseUrlEnc)) : null,
    credits: Math.floor(org.creditBalanceTokens / CREDIT_TOKEN_SCALE),
    creditBalanceTokens: org.creditBalanceTokens,
  };
}

function toInviteDTO(inv: { id: string; email: string; role: string; token: string; acceptedAt: Date | null; expiresAt: Date; createdAt: Date }): InviteDTO {
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role as InviteDTO["role"],
    token: inv.token,
    acceptedAt: inv.acceptedAt?.toISOString() ?? null,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  };
}

// ---- Organization profile ----

adminRouter.get("/admin/organization", async (req: AuthedRequest, res) => {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: req.org!.id } });
  return res.json(toOrgDTO(org));
});

adminRouter.patch("/admin/organization", async (req: AuthedRequest, res) => {
  const { name } = (req.body ?? {}) as UpdateOrgProfileRequest;
  if (!name || !name.trim()) return res.status(400).json({ error: "name required" });
  const org = await prisma.organization.update({ where: { id: req.org!.id }, data: { name: name.trim() } });
  return res.json(toOrgDTO(org));
});

// ---- Anthropic API key (one organization, one key) ----

adminRouter.put("/admin/organization/api-key", secretsLimit, async (req: AuthedRequest, res) => {
  const { apiKey } = (req.body ?? {}) as SetApiKeyRequest;
  if (!apiKey || !apiKey.trim()) return res.status(400).json({ error: "apiKey required" });
  try {
    // Cheap validation call — confirms the key is real before we store it.
    await new Anthropic({ apiKey: apiKey.trim() }).models.list();
  } catch {
    return res.status(400).json({ error: "That API key was rejected by Anthropic — check it and try again." });
  }
  const org = await prisma.organization.update({
    where: { id: req.org!.id },
    data: { anthropicApiKeyEnc: encryptSecret(apiKey.trim()) },
  });
  return res.json(toOrgDTO(org));
});

adminRouter.delete("/admin/organization/api-key", secretsLimit, async (req: AuthedRequest, res) => {
  const org = await prisma.organization.update({ where: { id: req.org!.id }, data: { anthropicApiKeyEnc: null } });
  return res.json(toOrgDTO(org));
});

// ---- Organization's own database (real per-org Neon connection) ----

adminRouter.put("/admin/organization/database", secretsLimit, async (req: AuthedRequest, res) => {
  const { databaseUrl } = (req.body ?? {}) as SetDatabaseRequest;
  if (!databaseUrl || !databaseUrl.trim()) return res.status(400).json({ error: "databaseUrl required" });
  try {
    // Test connectivity, run this project's full migration history against
    // it, and seed the builtin template library — all before we save
    // anything, so a bad connection string never gets persisted.
    await provisionTenantDatabase(databaseUrl.trim());
  } catch (err) {
    return res.status(400).json({ error: `Could not set up that database: ${(err as Error).message}` });
  }
  // No cache invalidation needed: tenantDb.ts's client cache is keyed by the
  // RESOLVED url, not this org's id, so the very next getTenantClient() call
  // for this org naturally resolves to (and reuses, or creates) the entry
  // for its new databaseUrlEnc.
  const org = await prisma.organization.update({
    where: { id: req.org!.id },
    data: { databaseUrlEnc: encryptSecret(databaseUrl.trim()) },
  });
  return res.json(toOrgDTO(org));
});

adminRouter.delete("/admin/organization/database", secretsLimit, async (req: AuthedRequest, res) => {
  const org = await prisma.organization.update({ where: { id: req.org!.id }, data: { databaseUrlEnc: null } });
  return res.json(toOrgDTO(org));
});

// ---- Members ----

adminRouter.get("/admin/members", async (req: AuthedRequest, res) => {
  const members = await prisma.user.findMany({ where: { organizationId: req.org!.id }, orderBy: { createdAt: "asc" } });
  const dtos: OrgMemberDTO[] = members.map((m) => ({
    userId: m.id,
    name: m.name,
    email: m.email,
    color: m.color,
    orgRole: (m.orgRole as OrgMemberDTO["orgRole"]) ?? "member",
  }));
  return res.json(dtos);
});

adminRouter.patch("/admin/members/:userId", async (req: AuthedRequest, res) => {
  const { orgRole } = (req.body ?? {}) as UpdateMemberRoleRequest;
  if (orgRole !== "admin" && orgRole !== "member") return res.status(400).json({ error: "orgRole must be admin or member" });
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target || target.organizationId !== req.org!.id) return res.status(404).json({ error: "Not a member of your organization" });
  if (target.id === req.user!.id && orgRole === "member") {
    const adminCount = await prisma.user.count({ where: { organizationId: req.org!.id, orgRole: "admin" } });
    if (adminCount <= 1) return res.status(400).json({ error: "You are the only admin — promote someone else first." });
  }
  const member = await prisma.user.update({ where: { id: target.id }, data: { orgRole } });
  return res.json({ userId: member.id, name: member.name, email: member.email, color: member.color, orgRole } satisfies OrgMemberDTO);
});

adminRouter.delete("/admin/members/:userId", async (req: AuthedRequest, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target || target.organizationId !== req.org!.id) return res.status(404).json({ error: "Not a member of your organization" });
  if (target.id === req.user!.id) return res.status(400).json({ error: "You cannot remove yourself." });
  await prisma.user.update({ where: { id: target.id }, data: { organizationId: null, orgRole: null } });
  return res.json({ ok: true });
});

// ---- Invites ----

adminRouter.get("/admin/invites", async (req: AuthedRequest, res) => {
  const invites = await prisma.invite.findMany({
    where: { organizationId: req.org!.id, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return res.json(invites.map(toInviteDTO));
});

adminRouter.post("/admin/invites", async (req: AuthedRequest, res) => {
  const { email, role } = (req.body ?? {}) as CreateInviteRequest;
  if (!email || !email.trim()) return res.status(400).json({ error: "email required" });
  if (role !== "admin" && role !== "member") return res.status(400).json({ error: "role must be admin or member" });
  const existingUser = await prisma.user.findUnique({ where: { email: email.trim() } });
  if (existingUser) return res.status(409).json({ error: "A user with that email already exists." });
  const invite = await prisma.invite.create({
    data: {
      organizationId: req.org!.id,
      email: email.trim(),
      role,
      token: createId("invite"),
      invitedByUserId: req.user!.id,
      invitedByName: req.user!.name,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return res.json(toInviteDTO(invite));
});

adminRouter.delete("/admin/invites/:id", async (req: AuthedRequest, res) => {
  const inv = await prisma.invite.findUnique({ where: { id: req.params.id } });
  if (!inv || inv.organizationId !== req.org!.id) return res.status(404).json({ error: "Invite not found" });
  await prisma.invite.delete({ where: { id: inv.id } });
  return res.json({ ok: true });
});

// ---- Credits ----

adminRouter.put("/admin/credits", async (req: AuthedRequest, res) => {
  const { credits } = (req.body ?? {}) as AddCreditsRequest;
  if (typeof credits !== "number" || !Number.isFinite(credits)) return res.status(400).json({ error: "credits (number) required" });
  const org = await prisma.organization.update({
    where: { id: req.org!.id },
    data: { creditBalanceTokens: { increment: Math.round(credits * CREDIT_TOKEN_SCALE) } },
  });
  return res.json(toOrgDTO(org));
});

// ---- Org-wide usage (UsageEvent lives in the tenant database) ----

adminRouter.get("/admin/usage", requireTenantDb, async (req: AuthedRequest, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days ?? 30)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const db = req.tenantDb!;

  // UsageEvent has no organizationId column — organizations that share the
  // platform's default database (haven't set their own yet) would otherwise
  // see every OTHER org's usage too. Scope explicitly to this org's own
  // member ids, the same defense-in-depth pattern as firmDocuments.ts.
  const orgUserIds = await getOrgUserIds(req.org!.id);

  const [events, org] = await Promise.all([
    db.usageEvent.findMany({
      where: { createdAt: { gte: since }, userId: { in: orgUserIds } },
      select: { kind: true, inputTokens: true, outputTokens: true, createdAt: true, userId: true },
    }),
    prisma.organization.findUniqueOrThrow({ where: { id: req.org!.id } }),
  ]);

  const nameById = new Map((await prisma.user.findMany({ where: { id: { in: orgUserIds } } })).map((u) => [u.id, u.name]));

  const byDayMap = new Map<string, UsageDayPoint>();
  const byKindMap = new Map<string, UsageByKind>();
  const byUserMap = new Map<string, UsageByUser>();
  let totalCalls = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (const e of events) {
    totalCalls++;
    totalIn += e.inputTokens;
    totalOut += e.outputTokens;

    const day = e.createdAt.toISOString().slice(0, 10);
    const d = byDayMap.get(day) ?? { date: day, inputTokens: 0, outputTokens: 0, calls: 0 };
    d.calls++;
    d.inputTokens += e.inputTokens;
    d.outputTokens += e.outputTokens;
    byDayMap.set(day, d);

    const k = byKindMap.get(e.kind) ?? { kind: e.kind, calls: 0, inputTokens: 0, outputTokens: 0 };
    k.calls++;
    k.inputTokens += e.inputTokens;
    k.outputTokens += e.outputTokens;
    byKindMap.set(e.kind, k);

    if (e.userId) {
      const u = byUserMap.get(e.userId) ?? { userId: e.userId, userName: nameById.get(e.userId) ?? "Former member", calls: 0, inputTokens: 0, outputTokens: 0 };
      u.calls++;
      u.inputTokens += e.inputTokens;
      u.outputTokens += e.outputTokens;
      byUserMap.set(e.userId, u);
    }
  }

  const summary: AdminUsageSummary = {
    rangeDays: days,
    credits: Math.floor(org.creditBalanceTokens / CREDIT_TOKEN_SCALE),
    creditBalanceTokens: org.creditBalanceTokens,
    totals: { calls: totalCalls, inputTokens: totalIn, outputTokens: totalOut },
    byDay: Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    byKind: Array.from(byKindMap.values()).sort((a, b) => b.calls - a.calls),
    byUser: Array.from(byUserMap.values()).sort((a, b) => b.calls - a.calls),
  };
  return res.json(summary);
});
