import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
import { getRole, requireCap } from "../auth/roles.js";
import { can } from "@docket/shared";
import {
  acceptProposal,
  rejectProposal,
  listProposals,
  markOutdatedByIds,
  reconcileOverlaps,
} from "../proposals/service.js";
import { currentRangeOffsets } from "../yjs/mutations.js";
import { whenLoaded } from "../yjs/docStore.js";
import { saveVersion } from "./versions.js";

export const proposalsRouter = Router();
proposalsRouter.use(requireAuth);

const docIdForProposal = async (req: AuthedRequest): Promise<string | undefined> => {
  const p = await prisma.diffProposal.findUnique({ where: { id: req.params.pid }, select: { documentId: true } });
  return p?.documentId;
};

// List proposals for a document (any member may read).
proposalsRouter.get("/documents/:id/proposals", async (req: AuthedRequest, res) => {
  const role = await getRole(req.params.id!, req.user!.id);
  if (!role) return res.status(403).json({ error: "Not a member" });
  return res.json(await listProposals(req.params.id!));
});

proposalsRouter.post("/proposals/:pid/accept", requireCap("review", docIdForProposal), async (req: AuthedRequest, res) => {
  try {
    const p = await prisma.diffProposal.findUniqueOrThrow({ where: { id: req.params.pid } });
    const result = await acceptProposal(req.params.pid!, { userId: req.user!.id, name: req.user!.name });
    // Flip other runs' hunks that overlapped the newly-accepted range.
    if (result.status === "accepted" || result.status === "edited_accepted") {
      const range = currentRangeOffsets(await whenLoaded(p.documentId), result.anchorStart, result.anchorEnd);
      if (range) await reconcileOverlaps(p.documentId, range);
      // Automatic version snapshot on every accepted agent change (Phase 5).
      await saveVersion(p.documentId, `Auto: accepted change`, true, { userId: req.user!.id, name: req.user!.name });
    }
    return res.json({ proposal: result });
  } catch (err) {
    return res.status(409).json({ error: (err as Error).message });
  }
});

proposalsRouter.post("/proposals/:pid/reject", requireCap("review", docIdForProposal), async (req: AuthedRequest, res) => {
  const result = await rejectProposal(req.params.pid!, { userId: req.user!.id, name: req.user!.name });
  return res.json({ proposal: result });
});

proposalsRouter.post("/proposals/:pid/edit-accept", requireCap("review", docIdForProposal), async (req: AuthedRequest, res) => {
  const { editedText } = req.body ?? {};
  if (typeof editedText !== "string") return res.status(400).json({ error: "editedText required" });
  try {
    const result = await acceptProposal(req.params.pid!, { userId: req.user!.id, name: req.user!.name }, { editedText });
    if (result.status === "edited_accepted") {
      await saveVersion(result.documentId, `Auto: edited-accepted change`, true, { userId: req.user!.id, name: req.user!.name });
    }
    return res.json({ proposal: result });
  } catch (err) {
    return res.status(409).json({ error: (err as Error).message });
  }
});

// Human edit overlapping a staged range → flip to outdated (conflict rule).
proposalsRouter.post("/documents/:id/mark-outdated", async (req: AuthedRequest, res) => {
  const role = await getRole(req.params.id!, req.user!.id);
  if (!role || !can(role, "edit")) return res.status(403).json({ error: "Cannot edit" });
  const { proposalIds } = req.body ?? {};
  if (!Array.isArray(proposalIds) || proposalIds.some((x) => typeof x !== "string")) {
    return res.status(400).json({ error: "proposalIds: string[] required" });
  }
  const flipped = await markOutdatedByIds(req.params.id!, proposalIds);
  return res.json(flipped);
});
