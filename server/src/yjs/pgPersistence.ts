import type { PrismaClient } from "@prisma/client";
import * as Y from "yjs";

/**
 * Postgres-backed replacement for y-leveldb's local-disk persistence — the
 * WS server (Render) has no persistent disk on the free tier, so live
 * document content lives in the org's own tenant database instead (see
 * schema.prisma's YjsUpdate model). Append-only update log, periodically
 * compacted so it doesn't grow unboundedly.
 */

const COMPACT_THRESHOLD = 100;

export async function loadIntoDoc(tenantDb: PrismaClient, documentId: string, doc: Y.Doc): Promise<void> {
  const rows = await tenantDb.yjsUpdate.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
    select: { data: true },
  });
  if (rows.length === 0) return;
  doc.transact(() => {
    for (const row of rows) Y.applyUpdate(doc, new Uint8Array(row.data));
  }, "pg-load");
}

export async function appendUpdate(tenantDb: PrismaClient, documentId: string, update: Uint8Array): Promise<void> {
  try {
    await tenantDb.yjsUpdate.create({ data: { documentId, data: Buffer.from(update) } });
  } catch (err) {
    console.error(`[yjs] failed to persist update for ${documentId}:`, (err as Error).message);
  }
}

/**
 * Replace this document's entire update log with one row holding the full
 * current state. `asOf` is captured BEFORE encoding and only rows with
 * createdAt <= asOf are deleted — an update that arrives concurrently
 * (its own appendUpdate racing this compaction) gets a LATER createdAt and
 * survives, so it is never silently dropped.
 */
export async function compact(tenantDb: PrismaClient, documentId: string, doc: Y.Doc): Promise<void> {
  const asOf = new Date();
  const full = Y.encodeStateAsUpdate(doc);
  try {
    await tenantDb.$transaction([
      tenantDb.yjsUpdate.deleteMany({ where: { documentId, createdAt: { lte: asOf } } }),
      tenantDb.yjsUpdate.create({ data: { documentId, data: Buffer.from(full), createdAt: asOf } }),
    ]);
  } catch (err) {
    console.error(`[yjs] compaction failed for ${documentId}:`, (err as Error).message);
  }
}

/** Wires a Y.Doc's updates to Postgres: persist every update, compact every COMPACT_THRESHOLD updates. */
export function attachPersistence(tenantDb: PrismaClient, documentId: string, doc: Y.Doc): void {
  let sinceCompact = 0;
  doc.on("update", (update: Uint8Array) => {
    void appendUpdate(tenantDb, documentId, update).then(() => {
      sinceCompact++;
      if (sinceCompact >= COMPACT_THRESHOLD) {
        sinceCompact = 0;
        void compact(tenantDb, documentId, doc);
      }
    });
  });
}
