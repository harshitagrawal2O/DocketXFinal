import * as Y from "yjs";
import { flattenFragment, resolveAnchor, type FlatDoc } from "./anchors.js";
import type { SerializedRelativePosition } from "@docket/shared";

export const FRAGMENT_FIELD = "default"; // Tiptap Collaboration default field

export function getFragment(doc: Y.Doc): Y.XmlFragment {
  return doc.getXmlFragment(FRAGMENT_FIELD);
}

export interface ResolvedRange {
  startLeaf: Y.XmlText;
  startIndex: number;
  endLeaf: Y.XmlText;
  endIndex: number;
  startGlobal: number;
  endGlobal: number;
}

export function resolveRange(
  doc: Y.Doc,
  anchorStart: SerializedRelativePosition,
  anchorEnd: SerializedRelativePosition,
): ResolvedRange | null {
  const flat = flattenFragment(getFragment(doc));
  const a = resolveAnchor(doc, flat, anchorStart);
  const b = resolveAnchor(doc, flat, anchorEnd);
  if (!a || !b) return null;
  if (b.globalOffset < a.globalOffset) return null;
  return {
    startLeaf: a.leaf,
    startIndex: a.index,
    endLeaf: b.leaf,
    endIndex: b.index,
    startGlobal: a.globalOffset,
    endGlobal: b.globalOffset,
  };
}

/**
 * Apply an accepted proposal: replace the anchored range with `text` inside a
 * single Yjs transaction (origin tags the update so clients can attribute it).
 * Returns false if anchors no longer resolve (proposal is outdated).
 *
 * Same-leaf replacement is a clean delete+insert. Cross-leaf ranges delete the
 * tail of the start leaf, the whole of intermediate leaves, and the head of the
 * end leaf, then insert the new text at the start — collapsing the range into
 * one run of text (documented constraint for clause-spanning edits).
 */
export function applyAccept(
  doc: Y.Doc,
  anchorStart: SerializedRelativePosition,
  anchorEnd: SerializedRelativePosition,
  text: string,
  origin: unknown = "viki-accept",
): boolean {
  const range = resolveRange(doc, anchorStart, anchorEnd);
  if (!range) return false;

  const flat = flattenFragment(getFragment(doc));

  doc.transact(() => {
    if (range.startLeaf === range.endLeaf) {
      const len = range.endIndex - range.startIndex;
      if (len > 0) range.startLeaf.delete(range.startIndex, len);
      if (text.length > 0) range.startLeaf.insert(range.startIndex, text);
      return;
    }

    // Cross-leaf: collect intermediate leaves between start and end.
    const startPos = flat.leaves.findIndex((l) => l.text === range.startLeaf);
    const endPos = flat.leaves.findIndex((l) => l.text === range.endLeaf);
    if (startPos === -1 || endPos === -1) return;

    // Delete head of end leaf.
    if (range.endIndex > 0) range.endLeaf.delete(0, range.endIndex);
    // Wipe intermediate leaves.
    for (let i = startPos + 1; i < endPos; i++) {
      const mid = flat.leaves[i]!.text;
      if (mid.length > 0) mid.delete(0, mid.length);
    }
    // Delete tail of start leaf and insert replacement.
    const startLen = range.startLeaf.length - range.startIndex;
    if (startLen > 0) range.startLeaf.delete(range.startIndex, startLen);
    if (text.length > 0) range.startLeaf.insert(range.startIndex, text);
  }, origin);

  return true;
}

/**
 * The conflict rule (claude.md): does a human edit range overlap a staged
 * proposal's range? Overlap flips the proposal to `outdated`. Touching
 * (edit end == proposal start) is NOT overlap.
 */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Current absolute offsets of a proposal's range, or null if unresolvable. */
export function currentRangeOffsets(
  doc: Y.Doc,
  anchorStart: SerializedRelativePosition,
  anchorEnd: SerializedRelativePosition,
): { start: number; end: number } | null {
  const r = resolveRange(doc, anchorStart, anchorEnd);
  if (!r) return null;
  return { start: r.startGlobal, end: r.endGlobal };
}

/** Flat plain-text snapshot of the current doc (for the agent to read). */
export function snapshotText(doc: Y.Doc): string {
  return flattenFragment(getFragment(doc)).text;
}

export type { FlatDoc };
