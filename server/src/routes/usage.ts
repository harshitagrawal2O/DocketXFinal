import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
import { requireTenantDb } from "../auth/org.js";
import type { UsageSummary, UsageDayPoint, UsageByKind, UsageByUser } from "@docket/shared";

export const usageRouter = Router();
usageRouter.use(requireAuth, requireTenantDb);

/**
 * Usage & billing aggregate (§4 metering). Scoped to the CALLER's own usage
 * within their organization's database — see the Admin portal's org-wide
 * credits/usage view (routes/admin.ts) for the whole-organization aggregate.
 */
usageRouter.get("/usage/summary", async (req: AuthedRequest, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days ?? 30)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const userId = req.user!.id;
  const db = req.tenantDb!;

  let events: { kind: string; inputTokens: number; outputTokens: number; createdAt: Date; userId: string | null }[];
  let documentsCreated: number;
  try {
    [events, documentsCreated] = await Promise.all([
      db.usageEvent.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { kind: true, inputTokens: true, outputTokens: true, createdAt: true, userId: true },
      }),
      db.document.count({ where: { ownerId: userId, createdAt: { gte: since } } }),
    ]);
  } catch (err) {
    console.error("[usage] summary query failed:", (err as Error).message);
    return res.status(503).json({ error: "Usage data is temporarily unavailable." });
  }

  const byDayMap = new Map<string, UsageDayPoint>();
  const byKindMap = new Map<string, UsageByKind>();
  let totalCalls = 0;
  let totalIn = 0;
  let totalOut = 0;
  let agentRuns = 0;

  for (const e of events) {
    totalCalls++;
    totalIn += e.inputTokens;
    totalOut += e.outputTokens;
    if (e.kind === "agent_run") agentRuns++;

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
  }

  const byUser: UsageByUser[] = [
    { userId, userName: req.user!.name, calls: totalCalls, inputTokens: totalIn, outputTokens: totalOut },
  ];

  const summary: UsageSummary = {
    rangeDays: days,
    totals: { calls: totalCalls, inputTokens: totalIn, outputTokens: totalOut },
    byDay: Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    byKind: Array.from(byKindMap.values()).sort((a, b) => b.calls - a.calls),
    byUser,
    documentsCreated,
    agentRuns,
  };
  return res.json(summary);
});
