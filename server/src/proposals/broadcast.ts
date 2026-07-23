import type { PrismaClient } from "@prisma/client";
import { getDoc } from "../yjs/docStore.js";
import type { DiffProposal } from "@docket/shared";

/**
 * Proposals sync to all doc clients through a Y.Map named "proposals" on the
 * shared Y.Doc. Writing here rides the same y-websocket channel as the text,
 * so every tab sees status changes live with no polling. Both the feed card
 * and the editor decoration read from this map (single source of truth).
 */
const PROPOSALS_MAP = "proposals";

export function upsertProposal(tenantDb: PrismaClient, p: DiffProposal): void {
  const map = getDoc(tenantDb, p.documentId).getMap<DiffProposal>(PROPOSALS_MAP);
  map.doc!.transact(() => map.set(p.id, p), "proposal-broadcast");
}
