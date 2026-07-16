import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { flattenFragment, anchorAtOffset, locateText } from "../anchors.js";
import { getFragment, applyAccept, snapshotText } from "../mutations.js";

/**
 * Whole-document drafting on a blank page (Viki AI tab, not a separate tool):
 * locateText's empty-oldText special case only applies when the document is
 * genuinely empty, and the bootstrap-empty-paragraph + insert flow runner.ts
 * uses must actually produce a clean, anchorable, acceptable result.
 */

function emptyDocWithBootstrapParagraph(): Y.Doc {
  const doc = new Y.Doc({ gc: false });
  const frag = getFragment(doc);
  doc.transact(() => {
    const el = new Y.XmlElement("paragraph");
    frag.insert(0, [el]);
    el.insert(0, [new Y.XmlText()]);
  }, "viki-bootstrap");
  return doc;
}

describe("locateText empty-oldText special case", () => {
  it("resolves to an insert-at-start range only when the document is genuinely empty", () => {
    expect(locateText("", "", "", "")).toEqual({ start: 0, end: 0 });
  });

  it("still refuses an empty oldText against a non-empty document (would be ambiguous)", () => {
    expect(locateText("Some real clause text.", "", "", "")).toBeNull();
  });
});

describe("whole-document draft insert (bootstrap paragraph + accept)", () => {
  it("stages and accepts a full document into a blank page", () => {
    const doc = emptyDocWithBootstrapParagraph();
    expect(snapshotText(doc)).toBe("");

    const flat = flattenFragment(getFragment(doc));
    const located = locateText(flat.text, "", "", "");
    expect(located).toEqual({ start: 0, end: 0 });

    const anchorStart = anchorAtOffset(flat, located!.start, 1);
    const anchorEnd = anchorAtOffset(flat, located!.end, -1);
    expect(anchorStart).not.toBeNull();
    expect(anchorEnd).not.toBeNull();

    const draft = "RENT AGREEMENT\n\n1. TERM\nThis lease runs for 11 months.\n\n2. RENT\nRs. 25,000 per month.";
    const ok = applyAccept(doc, anchorStart!, anchorEnd!, draft, "viki-accept");
    expect(ok).toBe(true);
    expect(snapshotText(doc)).toBe(draft);
  });

  it("a second run's anchors on the still-empty doc do not collide with an in-flight bootstrap", () => {
    // Simulates two hunks anchored before either is accepted (only one wins
    // in practice via first-accept-semantics elsewhere, but anchoring itself
    // must not throw or corrupt state).
    const doc = emptyDocWithBootstrapParagraph();
    const flat = flattenFragment(getFragment(doc));
    const a1 = anchorAtOffset(flat, 0, 1);
    const a2 = anchorAtOffset(flat, 0, -1);
    expect(a1).not.toBeNull();
    expect(a2).not.toBeNull();
  });
});
