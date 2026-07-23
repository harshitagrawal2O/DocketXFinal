import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
import { requireTenantDb } from "../auth/org.js";
import { getRole, requireCap } from "../auth/roles.js";
import { encodeSnapshot, textAtSnapshot, rollbackToSnapshot } from "../yjs/docStore.js";
import type { VersionSummary } from "@docket/shared";

export const versionsRouter = Router();
versionsRouter.use(requireAuth, requireTenantDb);

interface Actor {
  userId: string;
  name: string;
}

/** Save a named snapshot. Called manually and automatically on accepted runs. */
export async function saveVersion(tenantDb: PrismaClient, documentId: string, name: string, auto: boolean, actor: Actor | null): Promise<VersionSummary> {
  const snapshot = Buffer.from(await encodeSnapshot(tenantDb, documentId));
  const v = await tenantDb.version.create({
    data: {
      documentId,
      name,
      auto,
      snapshot,
      createdByUserId: actor?.userId ?? null,
      createdByName: actor?.name ?? null,
    },
  });
  await tenantDb.auditEvent.create({
    data: { documentId, type: "version_saved", userId: actor?.userId ?? null, userName: actor?.name ?? null, detail: { name, auto } },
  });
  return { id: v.id, documentId, name: v.name, auto: v.auto, createdAt: v.createdAt.toISOString(), createdByName: v.createdByName };
}

function toSummary(v: { id: string; documentId: string; name: string; auto: boolean; createdAt: Date; createdByName: string | null }): VersionSummary {
  return { id: v.id, documentId: v.documentId, name: v.name, auto: v.auto, createdAt: v.createdAt.toISOString(), createdByName: v.createdByName };
}

versionsRouter.get("/documents/:id/versions", async (req: AuthedRequest, res) => {
  const role = await getRole(req.tenantDb!, req.params.id!, req.user!.id);
  if (!role) return res.status(403).json({ error: "Not a member" });
  const versions = await req.tenantDb!.version.findMany({ where: { documentId: req.params.id }, orderBy: { createdAt: "desc" } });
  return res.json(versions.map(toSummary));
});

versionsRouter.post("/documents/:id/versions", requireCap("manage_versions"), async (req: AuthedRequest, res) => {
  const { name } = req.body ?? {};
  const v = await saveVersion(req.tenantDb!, req.params.id!, name || "Manual save", false, { userId: req.user!.id, name: req.user!.name });
  return res.json(v);
});

versionsRouter.get("/documents/:id/versions/:vid/text", async (req: AuthedRequest, res) => {
  const role = await getRole(req.tenantDb!, req.params.id!, req.user!.id);
  if (!role) return res.status(403).json({ error: "Not a member" });
  const v = await req.tenantDb!.version.findUniqueOrThrow({ where: { id: req.params.vid } });
  return res.json({ text: await textAtSnapshot(req.tenantDb!, req.params.id!, new Uint8Array(v.snapshot)) });
});

versionsRouter.get("/documents/:id/versions/diff", async (req: AuthedRequest, res) => {
  const role = await getRole(req.tenantDb!, req.params.id!, req.user!.id);
  if (!role) return res.status(403).json({ error: "Not a member" });
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  const [fv, tv] = await Promise.all([
    req.tenantDb!.version.findUniqueOrThrow({ where: { id: from } }),
    req.tenantDb!.version.findUniqueOrThrow({ where: { id: to } }),
  ]);
  const [fromText, toText] = await Promise.all([
    textAtSnapshot(req.tenantDb!, req.params.id!, new Uint8Array(fv.snapshot)),
    textAtSnapshot(req.tenantDb!, req.params.id!, new Uint8Array(tv.snapshot)),
  ]);
  return res.json({ fromText, toText });
});

versionsRouter.post("/documents/:id/versions/:vid/rollback", requireCap("manage_versions"), async (req: AuthedRequest, res) => {
  const v = await req.tenantDb!.version.findUniqueOrThrow({ where: { id: req.params.vid } });
  await rollbackToSnapshot(req.tenantDb!, req.params.id!, new Uint8Array(v.snapshot));
  await req.tenantDb!.auditEvent.create({
    data: { documentId: req.params.id!, type: "version_rollback", userId: req.user!.id, userName: req.user!.name, detail: { toVersion: v.name } },
  });
  // Rollback creates a NEW version (never destroys history).
  const newVersion = await saveVersion(req.tenantDb!, req.params.id!, `Rollback to "${v.name}"`, true, { userId: req.user!.id, name: req.user!.name });
  return res.json(newVersion);
});
