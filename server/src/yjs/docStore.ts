import type { PrismaClient } from "@prisma/client";
import * as Y from "yjs";
import { snapshotText } from "./mutations.js";
import { loadIntoDoc, attachPersistence } from "./pgPersistence.js";

/**
 * One gc-disabled Y.Doc per document, kept warm in memory and persisted to
 * the document's own tenant database (see pgPersistence.ts) rather than
 * local disk — the realtime WS server (Render free tier) has no persistent
 * disk, so live document content must live in Postgres instead of a local
 * y-leveldb directory. gc:false is REQUIRED so version-history snapshots
 * can reconstruct past states — see docs/phase-0-findings.md.
 *
 * Every function here takes `tenantDb` explicitly — the same pattern used
 * everywhere else in this app since the multi-tenant split (see
 * auth/org.ts) — because a document's content lives in whichever physical
 * database its organization uses, and there is no way to determine that
 * from a bare documentId alone.
 */

interface Entry {
  doc: Y.Doc;
  loaded: Promise<void>;
}

const registry = new Map<string, Entry>();

/**
 * Only the FIRST call for a given documentId actually uses `tenantDb` (to
 * load history and attach the persistence listener) — once registered, the
 * in-memory doc is returned regardless of which tenantDb a later caller
 * passes. documentIds are globally unique (cuid) and every real call site
 * already has the correct tenantDb for its own request, so in practice this
 * never mismatches.
 */
export function getDoc(tenantDb: PrismaClient, documentId: string): Y.Doc {
  let entry = registry.get(documentId);
  if (entry) return entry.doc;

  const doc = new Y.Doc({ gc: false });
  const loaded = (async () => {
    await loadIntoDoc(tenantDb, documentId, doc);
    attachPersistence(tenantDb, documentId, doc);
  })();

  entry = { doc, loaded };
  registry.set(documentId, entry);
  return doc;
}

export async function whenLoaded(tenantDb: PrismaClient, documentId: string): Promise<Y.Doc> {
  const entry = registry.get(documentId) ?? (getDoc(tenantDb, documentId), registry.get(documentId)!);
  await entry.loaded;
  return entry.doc;
}

export async function getText(tenantDb: PrismaClient, documentId: string): Promise<string> {
  return snapshotText(await whenLoaded(tenantDb, documentId));
}

/**
 * Encode a named snapshot of the current doc state (for a Version row).
 * whenLoaded (not getDoc) — this may be this process's FIRST touch of this
 * documentId (e.g. the API process saving a version for a document whose
 * live edits have only ever gone through the separate realtime process),
 * and getDoc alone can race the async Postgres load, encoding a snapshot of
 * a still-empty doc instead of its real content.
 */
export async function encodeSnapshot(tenantDb: PrismaClient, documentId: string): Promise<Uint8Array> {
  const doc = await whenLoaded(tenantDb, documentId);
  return Y.encodeSnapshotV2(Y.snapshot(doc));
}

/** Reconstruct the document text at a stored snapshot (for diff/version view). */
export async function textAtSnapshot(tenantDb: PrismaClient, documentId: string, snapshotBytes: Uint8Array): Promise<string> {
  const doc = await whenLoaded(tenantDb, documentId);
  const snap = Y.decodeSnapshotV2(snapshotBytes);
  const restored = Y.createDocFromSnapshot(doc, snap);
  return snapshotText(restored);
}

/**
 * Rollback = apply the historical state as new edits (never destroys history).
 * We compute the state-vector diff and reset the current fragment content to
 * match the snapshot's text within a transaction tagged as a rollback.
 */
export async function rollbackToSnapshot(tenantDb: PrismaClient, documentId: string, snapshotBytes: Uint8Array): Promise<void> {
  const doc = await whenLoaded(tenantDb, documentId);
  const snap = Y.decodeSnapshotV2(snapshotBytes);
  const restored = Y.createDocFromSnapshot(doc, snap);
  const update = Y.encodeStateAsUpdate(restored);
  Y.applyUpdate(doc, update, "rollback");
}
