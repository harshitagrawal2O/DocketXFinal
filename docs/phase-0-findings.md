# Phase 0 — Findings

Foundation gate for Docket v2. Two decisions had to be proven before any staging
or version-history work could start: (a) that a proposal's range stays attached
to the right text under concurrent editing, and (b) how the canonical document is
persisted so version history can reconstruct the past.

## (a) Relative-position anchor stability — PROVEN

**Claim.** A `DiffProposal` anchors its range with serialized Yjs *relative*
positions (`Y.createRelativePositionFromTypeIndex` →
`Y.encodeRelativePosition` → base64), never absolute character offsets. When a
collaborator edits *earlier* in the document, the anchor's resolved absolute
offset shifts so that it still brackets the **same clause text**. Absolute
offsets would silently point at the wrong text after the first concurrent edit.

**Proof.** `server/src/yjs/__tests__/anchor-stability.test.ts`.

The test:

1. Builds a gc-disabled `Y.Doc` whose `default` `XmlFragment` mimics the Tiptap
   Collaboration structure — one `Y.XmlElement("paragraph")` per block, each
   holding a `Y.XmlText` leaf (see the `makeDoc` helper).
2. Anchors a clause with `anchorAtOffset(flat, start, 1)` /
   `anchorAtOffset(flat, end, -1)` and records the resolved offsets via
   `currentRangeOffsets`.
3. Inserts text into an **earlier** leaf inside a separate transaction.
4. Asserts the resolved offsets shifted by *exactly* the inserted length **and**
   that `flat.text.slice(after.start, after.end)` still equals the original
   clause — while the *old* (absolute) offsets now slice out the wrong text.

A second case applies several earlier inserts across separate transactions and
confirms the anchor stays attached throughout.

**Why the association matters.** Range starts anchor with `assoc = 1` (bind to
the char *after*) and ends with `assoc = -1` (bind to the char *before*). This
keeps a range's intent stable: text inserted exactly at a boundary grows *around*
the range rather than swallowing or dropping it.

**API used (unchanged):** `flattenFragment`, `anchorAtOffset`, `resolveAnchor`,
`locateText`, `serializeRelPos`/`deserializeRelPos`
(`server/src/yjs/anchors.ts`); `resolveRange`, `currentRangeOffsets`,
`applyAccept`, `rangesOverlap`, `snapshotText`, `getFragment`, `FRAGMENT_FIELD`
(`server/src/yjs/mutations.ts`).

## (b) Persistence choice — y-leveldb with gc-disabled Y.Docs

Implementation: `server/src/yjs/docStore.ts`.

- **One `Y.Doc({ gc: false })` per document**, kept warm in an in-memory registry
  and persisted to **y-leveldb** (`LeveldbPersistence`, dir from
  `YJS_DATA_DIR`). On first access the doc is hydrated from leveldb; every
  subsequent `update` is written straight back (`persistence.storeUpdate`).
- The WebSocket server (`server/src/yjs/wsServer.ts`) and the seed script both
  obtain the doc through the same `getDoc` / `whenLoaded`, so there is exactly
  **one canonical copy** of each document's CRDT state.

### Why `gc: false` is mandatory (version history depends on it)

Yjs garbage collection deletes the tombstones of removed content once no
relative position references them. That is fine for pure live editing — but
**Phase 5 version history reconstructs past states from snapshots**, and a
snapshot is just a state vector + delete set. `Y.createDocFromSnapshot` can only
rebuild an old state if the structs it references still exist in the doc. With gc
enabled, deleted content is collected and old snapshots can no longer be
materialized — history becomes lossy.

So the whole doc lifecycle keeps gc off:

- **Save a version:** `encodeSnapshot` → `Y.encodeSnapshotV2(Y.snapshot(doc))`,
  stored in `Version.snapshot` (Bytes).
- **View an old version / diff:** `textAtSnapshot` →
  `Y.decodeSnapshotV2` + `Y.createDocFromSnapshot`, then `snapshotText`.
- **Roll back:** `rollbackToSnapshot` re-applies the historical state as *new*
  edits (tagged `"rollback"`) — it never destroys history, consistent with the
  append-only, nothing-is-deleted invariants.

### Consequence / trade-off

gc-disabled docs grow monotonically. Acceptable for legal documents (bounded
size, high audit value). If storage becomes a concern later, the mitigation is
snapshot compaction into new baseline docs — **not** turning gc on.
