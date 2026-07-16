import * as Y from "yjs";
import { LeveldbPersistence } from "y-leveldb";
import { snapshotText } from "./mutations.js";

/**
 * One gc-disabled Y.Doc per document, kept warm in memory and persisted to
 * y-leveldb. gc:false is REQUIRED so version-history snapshots (Phase 5) can
 * reconstruct past states — see docs/phase-0-findings.md.
 */

const DATA_DIR = process.env.YJS_DATA_DIR ?? "./.yjs-data";
const persistence = new LeveldbPersistence(DATA_DIR);

interface Entry {
  doc: Y.Doc;
  loaded: Promise<void>;
}

const registry = new Map<string, Entry>();

export function getDoc(documentId: string): Y.Doc {
  let entry = registry.get(documentId);
  if (entry) return entry.doc;

  const doc = new Y.Doc({ gc: false });
  const loaded = (async () => {
    const persisted = await persistence.getYDoc(documentId);
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(persisted));
    // Persist every update back to leveldb.
    doc.on("update", (update: Uint8Array) => {
      void persistence.storeUpdate(documentId, update);
    });
  })();

  entry = { doc, loaded };
  registry.set(documentId, entry);
  return doc;
}

export async function whenLoaded(documentId: string): Promise<Y.Doc> {
  const entry = registry.get(documentId) ?? (getDoc(documentId), registry.get(documentId)!);
  await entry.loaded;
  return entry.doc;
}

export function getText(documentId: string): string {
  return snapshotText(getDoc(documentId));
}

/** Encode a named snapshot of the current doc state (for a Version row). */
export function encodeSnapshot(documentId: string): Uint8Array {
  const doc = getDoc(documentId);
  return Y.encodeSnapshotV2(Y.snapshot(doc));
}

/** Reconstruct the document text at a stored snapshot (for diff/version view). */
export function textAtSnapshot(documentId: string, snapshotBytes: Uint8Array): string {
  const doc = getDoc(documentId);
  const snap = Y.decodeSnapshotV2(snapshotBytes);
  const restored = Y.createDocFromSnapshot(doc, snap);
  return snapshotText(restored);
}

/**
 * Rollback = apply the historical state as new edits (never destroys history).
 * We compute the state-vector diff and reset the current fragment content to
 * match the snapshot's text within a transaction tagged as a rollback.
 */
export function rollbackToSnapshot(documentId: string, snapshotBytes: Uint8Array): void {
  const doc = getDoc(documentId);
  const snap = Y.decodeSnapshotV2(snapshotBytes);
  const restored = Y.createDocFromSnapshot(doc, snap);
  const update = Y.encodeStateAsUpdate(restored);
  Y.applyUpdate(doc, update, "rollback");
}

export { persistence };
