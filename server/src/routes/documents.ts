import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
import { getRole, requireCap } from "../auth/roles.js";
import type { DocumentSummary, Role } from "@docket/shared";

export const documentsRouter = Router();

documentsRouter.use(requireAuth);

documentsRouter.get("/", async (req: AuthedRequest, res) => {
  const memberships = await prisma.documentMember.findMany({
    where: { userId: req.user!.id },
    include: { document: true },
    orderBy: { document: { updatedAt: "desc" } },
  });
  const docIds = memberships.map((m) => m.documentId);
  const pending = await prisma.diffProposal.findMany({
    where: { documentId: { in: docIds }, status: { in: ["staged", "streaming"] } },
    select: { documentId: true },
    distinct: ["documentId"],
  });
  const inReview = new Set(pending.map((p) => p.documentId));

  const summaries: DocumentSummary[] = memberships.map((m) => ({
    id: m.document.id,
    title: m.document.title,
    kind: m.document.kind as DocumentSummary["kind"],
    myRole: m.role as Role,
    updatedAt: m.document.updatedAt.toISOString(),
    status: inReview.has(m.documentId) ? "in_review" : "draft",
  }));
  res.json(summaries);
});

documentsRouter.post("/", async (req: AuthedRequest, res) => {
  const { title, kind } = req.body ?? {};
  if (!title) return res.status(400).json({ error: "title required" });
  const doc = await prisma.document.create({
    data: {
      title,
      kind: kind ?? "contract",
      ownerId: req.user!.id,
      members: { create: { userId: req.user!.id, role: "owner" } },
    },
  });
  const summary: DocumentSummary = {
    id: doc.id,
    title: doc.title,
    kind: doc.kind as DocumentSummary["kind"],
    myRole: "owner",
    updatedAt: doc.updatedAt.toISOString(),
    status: "draft",
  };
  return res.json(summary);
});

documentsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const role = await getRole(req.params.id!, req.user!.id);
  if (!role) return res.status(403).json({ error: "Not a member" });
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { members: { include: { user: true } } },
  });
  return res.json({
    summary: {
      id: doc.id,
      title: doc.title,
      kind: doc.kind as DocumentSummary["kind"],
      myRole: role,
      updatedAt: doc.updatedAt.toISOString(),
      status: "draft",
    } satisfies DocumentSummary,
    members: doc.members.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email, color: m.user.color, role: m.role })),
    // Present only for template-generated docs; client seeds it into the empty
    // Yjs doc on first open (guarded so only one client seeds).
    initialHtml: doc.initialHtml ?? null,
  });
});

// Owner-only sharing management.
documentsRouter.post("/:id/members", requireCap("manage_sharing"), async (req: AuthedRequest, res) => {
  const { email, role } = req.body ?? {};
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: "No user with that email" });
  const member = await prisma.documentMember.upsert({
    where: { documentId_userId: { documentId: req.params.id!, userId: user.id } },
    update: { role },
    create: { documentId: req.params.id!, userId: user.id, role },
  });
  await prisma.auditEvent.create({
    data: { documentId: req.params.id!, type: "role_changed", userId: req.user!.id, userName: req.user!.name, detail: { target: user.name, role } },
  });
  return res.json({ userId: user.id, name: user.name, role: member.role });
});

documentsRouter.patch("/:id/members/:userId", requireCap("manage_sharing"), async (req: AuthedRequest, res) => {
  const { role } = req.body ?? {};
  const member = await prisma.documentMember.update({
    where: { documentId_userId: { documentId: req.params.id!, userId: req.params.userId! } },
    data: { role },
    include: { user: true },
  });
  await prisma.auditEvent.create({
    data: { documentId: req.params.id!, type: "role_changed", userId: req.user!.id, userName: req.user!.name, detail: { target: member.user.name, role } },
  });
  return res.json({ userId: member.userId, name: member.user.name, role: member.role });
});

documentsRouter.delete("/:id/members/:userId", requireCap("manage_sharing"), async (req: AuthedRequest, res) => {
  if (req.params.userId === req.user!.id) return res.status(400).json({ error: "Owner cannot remove themself" });
  const member = await prisma.documentMember.findUnique({
    where: { documentId_userId: { documentId: req.params.id!, userId: req.params.userId! } },
    include: { user: true },
  });
  if (!member) return res.status(404).json({ error: "Not a member" });
  await prisma.documentMember.delete({ where: { documentId_userId: { documentId: req.params.id!, userId: req.params.userId! } } });
  await prisma.auditEvent.create({
    data: { documentId: req.params.id!, type: "role_changed", userId: req.user!.id, userName: req.user!.name, detail: { target: member.user.name, role: "removed" } },
  });
  return res.json({ ok: true });
});
