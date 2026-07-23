import type { Prisma, PrismaClient } from "@prisma/client";
import { whenLoaded } from "../yjs/docStore.js";
import { applyAccept, currentRangeOffsets, rangesOverlap } from "../yjs/mutations.js";
import { upsertProposal } from "./broadcast.js";
import type { Citation, DiffProposal, ProposalStatus } from "@docket/shared";

type Row = Prisma.DiffProposalGetPayload<{}>;

export function toDTO(row: Row): DiffProposal {
  return {
    id: row.id,
    documentId: row.documentId,
    agentRunId: row.agentRunId,
    anchorStart: row.anchorStart,
    anchorEnd: row.anchorEnd,
    oldText: row.oldText,
    newText: row.newText,
    editedText: row.editedText,
    reasoning: row.reasoning,
    citations: row.citations as unknown as Citation[],
    status: row.status as ProposalStatus,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedByUserId: row.resolvedByUserId,
    resolvedByName: row.resolvedByName,
    hunkIndex: row.hunkIndex,
  };
}

/** Terminal statuses can't transition again — enforces idempotency under races. */
const TERMINAL: ProposalStatus[] = ["accepted", "rejected", "edited_accepted"];

interface Actor {
  userId: string;
  name: string;
}

async function audit(
  tenantDb: PrismaClient,
  documentId: string,
  type: string,
  actor: Actor | null,
  extra: { proposalId?: string; agentRunId?: string; detail?: Record<string, string | number | boolean | null> },
): Promise<void> {
  await tenantDb.auditEvent.create({
    data: {
      documentId,
      type,
      userId: actor?.userId ?? null,
      userName: actor?.name ?? null,
      proposalId: extra.proposalId ?? null,
      agentRunId: extra.agentRunId ?? null,
      detail: (extra.detail ?? null) as Prisma.InputJsonValue,
    },
  });
}

/**
 * Accept: apply newText (or editedText) as a Yjs transaction at the relative
 * range, flip status, write an AuditEvent, broadcast. Idempotent — a second
 * concurrent accept sees a terminal status and returns the existing state
 * (Phase 4: first-accept-wins, exactly one transaction + one AuditEvent).
 */
export async function acceptProposal(
  tenantDb: PrismaClient,
  proposalId: string,
  actor: Actor,
  opts: { editedText?: string } = {},
): Promise<DiffProposal> {
  return tenantDb.$transaction(async (tx) => {
    const row = await tx.diffProposal.findUniqueOrThrow({ where: { id: proposalId } });
    if (TERMINAL.includes(row.status as ProposalStatus)) return toDTO(row);
    if (row.status === "outdated") throw new Error("Proposal is outdated; re-run on current text");
    if (row.status === "streaming") throw new Error("Proposal is still streaming");

    const isEdit = opts.editedText !== undefined;
    const text = isEdit ? opts.editedText! : row.newText;

    // getDoc() alone can race the async leveldb load on first access in this
    // process — a false "anchors don't resolve" would wrongly flip a valid
    // proposal to outdated instead of applying it. Await the load.
    const doc = await whenLoaded(tenantDb, row.documentId);
    const ok = applyAccept(doc, row.anchorStart, row.anchorEnd, text, "viki-accept");
    if (!ok) {
      // Anchors no longer resolve — treat as outdated rather than corrupt text.
      const outdated = await tx.diffProposal.update({
        where: { id: proposalId },
        data: { status: "outdated" },
      });
      const dto = toDTO(outdated);
      upsertProposal(tenantDb, dto);
      return dto;
    }

    const updated = await tx.diffProposal.update({
      where: { id: proposalId },
      data: {
        status: isEdit ? "edited_accepted" : "accepted",
        editedText: isEdit ? text : null,
        resolvedAt: new Date(),
        resolvedByUserId: actor.userId,
        resolvedByName: actor.name,
      },
    });

    await audit(tenantDb, row.documentId, isEdit ? "proposal_edited_accepted" : "proposal_accepted", actor, {
      proposalId: row.id,
      agentRunId: row.agentRunId,
      detail: isEdit
        ? { originalLength: row.newText.length, editedLength: text.length }
        : { newLength: text.length },
    });

    const dto = toDTO(updated);
    upsertProposal(tenantDb, dto);
    return dto;
  });
}

/** Reject: flip to rejected, keep visible (never delete), audit, broadcast. */
export async function rejectProposal(tenantDb: PrismaClient, proposalId: string, actor: Actor): Promise<DiffProposal> {
  return tenantDb.$transaction(async (tx) => {
    const row = await tx.diffProposal.findUniqueOrThrow({ where: { id: proposalId } });
    if (TERMINAL.includes(row.status as ProposalStatus)) return toDTO(row);

    const updated = await tx.diffProposal.update({
      where: { id: proposalId },
      data: {
        status: "rejected",
        resolvedAt: new Date(),
        resolvedByUserId: actor.userId,
        resolvedByName: actor.name,
      },
    });
    await audit(tenantDb, row.documentId, "proposal_rejected", actor, { proposalId: row.id, agentRunId: row.agentRunId });
    const dto = toDTO(updated);
    upsertProposal(tenantDb, dto);
    return dto;
  });
}

/**
 * Conflict rule: flip every `staged` proposal whose range overlaps a human
 * edit range to `outdated` in all tabs. Non-overlapping / touching edits are
 * left staged (relative anchors keep them attached).
 */
export async function markOutdatedForEdit(
  tenantDb: PrismaClient,
  documentId: string,
  editRange: { start: number; end: number },
): Promise<DiffProposal[]> {
  const doc = await whenLoaded(tenantDb, documentId);
  const staged = await tenantDb.diffProposal.findMany({
    where: { documentId, status: "staged" },
  });

  const flipped: DiffProposal[] = [];
  for (const row of staged) {
    const range = currentRangeOffsets(doc, row.anchorStart, row.anchorEnd);
    if (!range) continue;
    if (rangesOverlap(editRange.start, editRange.end, range.start, range.end)) {
      const updated = await tenantDb.diffProposal.update({
        where: { id: row.id },
        data: { status: "outdated" },
      });
      await audit(tenantDb, documentId, "proposal_outdated", null, {
        proposalId: row.id,
        agentRunId: row.agentRunId,
      });
      const dto = toDTO(updated);
      upsertProposal(tenantDb, dto);
      flipped.push(dto);
    }
  }
  return flipped;
}

/**
 * Client-driven conflict rule: the editor already resolves both the human edit
 * range and each staged proposal's range to ProseMirror positions (via the
 * y-prosemirror binding) and detects overlap there, then sends the overlapping
 * proposal ids. We flip exactly those that are still `staged` — the server
 * stays authoritative on the status transition without needing to translate
 * between ProseMirror and flat-text coordinate systems.
 */
export async function markOutdatedByIds(tenantDb: PrismaClient, documentId: string, proposalIds: string[]): Promise<DiffProposal[]> {
  const flipped: DiffProposal[] = [];
  for (const id of proposalIds) {
    const row = await tenantDb.diffProposal.findUnique({ where: { id } });
    if (!row || row.documentId !== documentId || row.status !== "staged") continue;
    const updated = await tenantDb.diffProposal.update({ where: { id }, data: { status: "outdated" } });
    await audit(tenantDb, documentId, "proposal_outdated", null, { proposalId: id, agentRunId: row.agentRunId });
    const dto = toDTO(updated);
    upsertProposal(tenantDb, dto);
    flipped.push(dto);
  }
  return flipped;
}

/**
 * When accepting a proposal changes text under another run's staged hunk, that
 * other hunk becomes outdated (Phase 4: overlapping hunks from two runs).
 */
export async function reconcileOverlaps(tenantDb: PrismaClient, documentId: string, acceptedRange: { start: number; end: number }): Promise<void> {
  await markOutdatedForEdit(tenantDb, documentId, acceptedRange);
}

export async function listProposals(tenantDb: PrismaClient, documentId: string): Promise<DiffProposal[]> {
  const rows = await tenantDb.diffProposal.findMany({
    where: { documentId },
    orderBy: [{ agentRunId: "asc" }, { hunkIndex: "asc" }],
  });
  return rows.map(toDTO);
}
