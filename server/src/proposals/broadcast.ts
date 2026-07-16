import * as Y from "yjs";
import { getDoc } from "../yjs/docStore.js";
import type { DiffProposal } from "@docket/shared";

/**
 * Proposals sync to all doc clients through a Y.Map named "proposals" on the
 * shared Y.Doc. Writing here rides the same y-websocket channel as the text,
 * so every tab sees status changes live with no polling. Both the feed card
 * and the editor decoration read from this map (single source of truth).
 */
const PROPOSALS_MAP = "proposals";

function proposalsMap(documentId: string): Y.Map<DiffProposal> {
  return getDoc(documentId).getMap<DiffProposal>(PROPOSALS_MAP);
}

export function upsertProposal(p: DiffProposal): void {
  const map = proposalsMap(p.documentId);
  map.doc!.transact(() => map.set(p.id, p), "proposal-broadcast");
}

export function upsertMany(documentId: string, ps: DiffProposal[]): void {
  const map = proposalsMap(documentId);
  map.doc!.transact(() => ps.forEach((p) => map.set(p.id, p)), "proposal-broadcast");
}

export function removeProposal(documentId: string, proposalId: string): void {
  const map = proposalsMap(documentId);
  map.doc!.transact(() => map.delete(proposalId), "proposal-broadcast");
}
