import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
import { getRole } from "../auth/roles.js";
import type { AuditEventDTO, AuditPage } from "@docket/shared";

export const auditRouter = Router();
auditRouter.use(requireAuth);

const PAGE = 50;

auditRouter.get("/documents/:id/audit", async (req: AuthedRequest, res) => {
  const role = await getRole(req.params.id!, req.user!.id);
  if (!role) return res.status(403).json({ error: "Not a member" });

  const type = req.query.type ? String(req.query.type) : undefined;
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

  const rows = await prisma.auditEvent.findMany({
    where: { documentId: req.params.id!, ...(type ? { type } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > PAGE;
  const events: AuditEventDTO[] = rows.slice(0, PAGE).map((r) => ({
    id: r.id,
    documentId: r.documentId,
    type: r.type as AuditEventDTO["type"],
    userId: r.userId,
    userName: r.userName,
    proposalId: r.proposalId,
    agentRunId: r.agentRunId,
    detail: (r.detail as AuditEventDTO["detail"]) ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));

  const page: AuditPage = { events, nextCursor: hasMore ? rows[PAGE - 1]!.id : null };
  return res.json(page);
});
