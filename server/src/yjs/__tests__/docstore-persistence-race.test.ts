import { describe, it, expect, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import * as Y from "yjs";
import { getDoc, whenLoaded, encodeSnapshot, textAtSnapshot } from "../docStore.js";
import { getFragment } from "../mutations.js";

/**
 * Regression test for a real bug found while verifying the Vercel/Render
 * split deployment: encodeSnapshot/textAtSnapshot/rollbackToSnapshot used
 * to call the SYNCHRONOUS getDoc() directly instead of awaiting whenLoaded()
 * first. That races the async Postgres load on a documentId's FIRST touch
 * in this process — harmless in the old single-process world (the doc was
 * almost always already loaded via an earlier whenLoaded call), but a
 * genuine data-loss-looking bug once the API and realtime WS server run as
 * SEPARATE processes with separate in-memory registries: saving a version
 * for a document this process has never touched produced an EMPTY
 * snapshot instead of the document's real (already-persisted) content.
 * Verified live against a real Postgres-backed run before this test was
 * written; this test guards the same property with a fake tenantDb so it
 * stays hermetic.
 */

interface FakeRow {
  documentId: string;
  data: Buffer;
  createdAt: Date;
}

function fakeTenantDb(seedRows: FakeRow[]): PrismaClient {
  const rows = [...seedRows];
  return {
    yjsUpdate: {
      findMany: async ({ where }: { where: { documentId: string } }) =>
        rows
          .filter((r) => r.documentId === where.documentId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    },
  } as unknown as PrismaClient;
}

/** A documentId unique per test so docStore's module-level registry never leaks state between tests. */
let counter = 0;
function freshDocumentId(): string {
  counter++;
  return `race-test-doc-${counter}`;
}

function buildSeedUpdate(documentId: string, text: string): FakeRow {
  const seedDoc = new Y.Doc({ gc: false });
  const frag = getFragment(seedDoc);
  seedDoc.transact(() => {
    const el = new Y.XmlElement("paragraph");
    frag.insert(0, [el]);
    const leaf = new Y.XmlText();
    el.insert(0, [leaf]);
    leaf.insert(0, text);
  });
  return { documentId, data: Buffer.from(Y.encodeStateAsUpdate(seedDoc)), createdAt: new Date() };
}

describe("docStore: reads must await the Postgres load, not race it", () => {
  beforeEach(() => {
    // No explicit registry-reset export exists (by design — see docStore.ts),
    // so every test uses its own fresh documentId instead.
  });

  it("encodeSnapshot on a documentId this process has never touched reflects pre-existing Postgres content, not an empty doc", async () => {
    const documentId = freshDocumentId();
    const tenantDb = fakeTenantDb([buildSeedUpdate(documentId, "pre-existing content")]);

    // The bug: calling encodeSnapshot on a BRAND NEW documentId (first touch
    // in this process) used to read the doc synchronously before the async
    // load from tenantDb finished, encoding an empty snapshot.
    const snapshotBytes = await encodeSnapshot(tenantDb, documentId);

    // Decode the snapshot back to text via a fresh doc, same technique textAtSnapshot uses internally.
    const doc = await whenLoaded(tenantDb, documentId);
    const snap = Y.decodeSnapshotV2(snapshotBytes);
    const restored = Y.createDocFromSnapshot(doc, snap);
    expect(restored.getXmlFragment("default").toString()).toContain("pre-existing content");
  });

  it("textAtSnapshot on a documentId this process has never touched also reflects pre-existing content", async () => {
    const documentId = freshDocumentId();
    const tenantDb = fakeTenantDb([buildSeedUpdate(documentId, "other pre-existing content")]);

    const snapshotBytes = await encodeSnapshot(tenantDb, documentId);
    const text = await textAtSnapshot(tenantDb, documentId, snapshotBytes);
    expect(text).toContain("other pre-existing content");
  });

  it("getDoc alone (no await) can still return a momentarily-empty doc — whenLoaded is what callers must use", async () => {
    const documentId = freshDocumentId();
    const tenantDb = fakeTenantDb([buildSeedUpdate(documentId, "loaded later")]);

    const doc = getDoc(tenantDb, documentId); // synchronous, may race the load
    const flatImmediately = doc.getXmlFragment("default").toString();
    await whenLoaded(tenantDb, documentId);
    const flatAfterLoad = doc.getXmlFragment("default").toString();

    // Not asserting flatImmediately is ALWAYS empty (timing-dependent, would
    // be a flaky test) — asserting the documented, safe pattern: after
    // whenLoaded resolves, the content is definitely there.
    expect(flatAfterLoad).toContain("loaded later");
    void flatImmediately;
  });
});
