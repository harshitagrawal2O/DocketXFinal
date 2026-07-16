import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { flattenFragment, anchorAtOffset } from "../anchors.js";
import { getFragment, currentRangeOffsets } from "../mutations.js";

/**
 * THE Phase-0 findings proof (see docs/phase-0-findings.md).
 *
 * A DiffProposal's range is anchored with Yjs RELATIVE positions, never
 * absolute offsets. This test demonstrates the CRDT guarantee we lean on: a
 * concurrent insert EARLIER in the document shifts the anchor's resolved
 * absolute offset so it still points at the SAME clause text. If we had stored
 * an absolute offset instead, it would now point at the wrong text.
 */

/**
 * Build a gc-disabled Y.Doc whose "default" XmlFragment mimics the Tiptap
 * Collaboration structure: one Y.XmlElement("paragraph") per block, each
 * holding a single Y.XmlText leaf. flattenFragment joins paragraphs with "\n".
 */
function makeDoc(paragraphs: string[]): Y.Doc {
  const doc = new Y.Doc({ gc: false });
  const frag = getFragment(doc);
  doc.transact(() => {
    for (const p of paragraphs) {
      const el = new Y.XmlElement("paragraph");
      frag.insert(frag.length, [el]);
      const leaf = new Y.XmlText();
      el.insert(0, [leaf]);
      leaf.insert(0, p);
    }
  });
  return doc;
}

const PARAS = [
  "1. This Agreement is made at Bengaluru on the Effective Date.",
  "2. The Service Provider shall render the Services with due care and skill.",
  "3. This Agreement shall be governed by the laws of India.",
];
const CLAUSE = "with due care and skill";

describe("relative-position anchor stability", () => {
  it("survives a concurrent insert EARLIER in the document", () => {
    const doc = makeDoc(PARAS);
    const flat = flattenFragment(getFragment(doc));

    const start = flat.text.indexOf(CLAUSE);
    const end = start + CLAUSE.length;
    expect(start).toBeGreaterThan(0);

    // Anchor the range: start binds to the char after (assoc 1), end binds to
    // the char before (assoc -1) so both keep their intent under inserts.
    const anchorStart = anchorAtOffset(flat, start, 1);
    const anchorEnd = anchorAtOffset(flat, end, -1);
    expect(anchorStart).toBeTruthy();
    expect(anchorEnd).toBeTruthy();

    const before = currentRangeOffsets(doc, anchorStart!, anchorEnd!);
    expect(before).toEqual({ start, end });
    expect(flat.text.slice(before!.start, before!.end)).toBe(CLAUSE);

    // A different collaborator inserts text into an EARLIER leaf (paragraph 1).
    const INSERT = "PREAMBLE — ";
    const firstLeaf = flattenFragment(getFragment(doc)).leaves[0]!.text;
    doc.transact(() => firstLeaf.insert(0, INSERT), "other-user");

    const flat2 = flattenFragment(getFragment(doc));
    const after = currentRangeOffsets(doc, anchorStart!, anchorEnd!);
    expect(after).not.toBeNull();

    // The resolved absolute offsets shifted by exactly the inserted length...
    expect(after!.start).toBe(before!.start + INSERT.length);
    expect(after!.end).toBe(before!.end + INSERT.length);

    // ...and still bracket the SAME clause text. This is the whole proof.
    expect(flat2.text.slice(after!.start, after!.end)).toBe(CLAUSE);

    // Contrast: a stored ABSOLUTE offset would now point at the wrong text,
    // which is exactly why the staging layer forbids absolute offsets.
    expect(flat2.text.slice(before!.start, before!.end)).not.toBe(CLAUSE);
  });

  it("stays attached after multiple earlier inserts across separate transactions", () => {
    const doc = makeDoc(PARAS);
    const flat = flattenFragment(getFragment(doc));
    const start = flat.text.indexOf(CLAUSE);
    const end = start + CLAUSE.length;

    const anchorStart = anchorAtOffset(flat, start, 1)!;
    const anchorEnd = anchorAtOffset(flat, end, -1)!;

    const firstLeaf = flattenFragment(getFragment(doc)).leaves[0]!.text;
    doc.transact(() => firstLeaf.insert(0, "A "), "u1");
    doc.transact(() => firstLeaf.insert(0, "B "), "u2");
    doc.transact(() => firstLeaf.insert(firstLeaf.length, " C"), "u3");

    const flat2 = flattenFragment(getFragment(doc));
    const after = currentRangeOffsets(doc, anchorStart, anchorEnd)!;
    expect(flat2.text.slice(after.start, after.end)).toBe(CLAUSE);
  });
});
