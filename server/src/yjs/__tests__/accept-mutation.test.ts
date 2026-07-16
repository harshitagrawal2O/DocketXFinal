import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { flattenFragment, anchorAtOffset, locateText } from "../anchors.js";
import { getFragment, applyAccept, resolveRange, snapshotText } from "../mutations.js";

/**
 * Accept-mutation correctness (claude.md invariant: the accept path rewrites
 * legal documents and must never corrupt text). We locate a clause, anchor it,
 * apply the accepted replacement, and assert the doc now contains newText and
 * not oldText at the right position — including under a concurrent edit
 * elsewhere (relative positions must hold).
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

function anchorsFor(
  doc: Y.Doc,
  oldText: string,
  contextBefore: string,
  contextAfter: string,
): { anchorStart: string; anchorEnd: string } {
  const flat = flattenFragment(getFragment(doc));
  const loc = locateText(flat.text, oldText, contextBefore, contextAfter);
  if (!loc) throw new Error(`could not locate: ${oldText}`);
  const anchorStart = anchorAtOffset(flat, loc.start, 1);
  const anchorEnd = anchorAtOffset(flat, loc.end, -1);
  if (!anchorStart || !anchorEnd) throw new Error("anchoring failed");
  return { anchorStart, anchorEnd };
}

describe("applyAccept — same-leaf replacement", () => {
  it("replaces the anchored clause with newText", () => {
    const doc = makeDoc(PARAS);
    const OLD = "with due care and skill";
    const NEW = "with reasonable care, skill and diligence";
    const { anchorStart, anchorEnd } = anchorsFor(doc, OLD, "render the Services ", ".");

    const ok = applyAccept(doc, anchorStart, anchorEnd, NEW, "viki-accept");
    expect(ok).toBe(true);

    const text = snapshotText(doc);
    expect(text).toContain(NEW);
    expect(text).not.toContain(OLD);
    // Placed exactly where the old clause was — the sentence still reads right.
    expect(text).toContain("shall render the Services with reasonable care, skill and diligence.");
  });

  it("still targets the correct range after a concurrent edit ELSEWHERE", () => {
    const doc = makeDoc(PARAS);
    const OLD = "with due care and skill";
    const NEW = "in a professional and workmanlike manner";

    // Anchors captured BEFORE the concurrent edit.
    const { anchorStart, anchorEnd } = anchorsFor(doc, OLD, "render the Services ", ".");

    // A collaborator edits an earlier, unrelated leaf.
    const firstLeaf = flattenFragment(getFragment(doc)).leaves[0]!.text;
    doc.transact(() => firstLeaf.insert(0, "RECITAL. "), "other-user");

    const ok = applyAccept(doc, anchorStart, anchorEnd, NEW, "viki-accept");
    expect(ok).toBe(true);

    const text = snapshotText(doc);
    expect(text).toContain(NEW);
    expect(text).not.toContain(OLD);
    expect(text).toContain("RECITAL."); // the concurrent edit survived
    expect(text).toContain("shall render the Services in a professional and workmanlike manner.");
  });
});

describe("applyAccept — cross-leaf replacement (documented collapse)", () => {
  /**
   * mutations.ts documents the cross-leaf constraint: a range spanning leaves
   * collapses into one run of text in the start leaf (tail of start + head of
   * end deleted, replacement inserted at start). We assert the collapse result
   * loosely — the replacement is present and both deleted fragments are gone —
   * rather than exact whitespace, which is governed by the paragraph-separator
   * handling in flattenFragment.
   */
  it("collapses a range spanning two paragraphs into the replacement text", () => {
    const doc = makeDoc(PARAS);
    const flat = flattenFragment(getFragment(doc));

    const startOffset = flat.text.indexOf("due care and skill");
    const endOffset = flat.text.indexOf("shall be governed"); // in the next paragraph
    expect(startOffset).toBeGreaterThan(0);
    expect(endOffset).toBeGreaterThan(startOffset);

    const anchorStart = anchorAtOffset(flat, startOffset, 1)!;
    const anchorEnd = anchorAtOffset(flat, endOffset, -1)!;

    // Confirm this really is a cross-leaf range before mutating.
    const range = resolveRange(doc, anchorStart, anchorEnd)!;
    expect(range.startLeaf).not.toBe(range.endLeaf);

    const ok = applyAccept(doc, anchorStart, anchorEnd, "X ", "viki-accept");
    expect(ok).toBe(true);

    const text = snapshotText(doc);
    // Deleted span begins at "due", so the preceding "with " stays put and the
    // replacement lands right after it.
    expect(text).toContain("render the Services with X");
    expect(text).toContain("shall be governed by the laws of India.");
    expect(text).not.toContain("due care and skill");
    expect(text).not.toContain("3. This Agreement shall be governed");
  });

  it.skip("cross-leaf exact whitespace/paragraph-merge shape (constraint, revisit if Tiptap schema changes)", () => {
    // Intentionally skipped: the exact surviving separator between the two
    // now-partially-emptied paragraph elements depends on flattenFragment's
    // block-separator rule. Asserting the precise string here would be brittle;
    // the collapse *content* is covered by the test above.
  });
});
