import * as Y from "yjs";
import { toBase64, fromBase64 } from "lib0/buffer";
import type { SerializedRelativePosition } from "@docket/shared";

/**
 * ANCHORING FOUNDATION.
 *
 * The entire staging layer depends on this: a proposal's range must stay
 * attached to the right text even after collaborators edit elsewhere in the
 * doc. We anchor with Yjs RELATIVE positions (never absolute offsets).
 *
 * Tiptap/ProseMirror stores paragraph text in Y.XmlText leaves inside a
 * Y.XmlFragment. A character position in the document maps to a specific
 * leaf + local offset. We create relative positions against those leaves, so
 * concurrent inserts earlier in the doc shift the resolved absolute index
 * automatically — that is the Yjs CRDT guarantee we lean on.
 */

export interface Leaf {
  text: Y.XmlText;
  /** Global text offset where this leaf's content begins. */
  start: number;
  length: number;
}

export interface FlatDoc {
  /** Whole-document plain text (paragraphs joined by "\n"). */
  text: string;
  leaves: Leaf[];
}

/** Walk the XmlFragment collecting Y.XmlText leaves in document order. */
export function flattenFragment(fragment: Y.XmlFragment): FlatDoc {
  const leaves: Leaf[] = [];
  let offset = 0;
  const parts: string[] = [];

  const visit = (node: Y.XmlElement | Y.XmlText | Y.XmlFragment | Y.XmlHook) => {
    if (node instanceof Y.XmlText) {
      const s = node.toString();
      leaves.push({ text: node, start: offset, length: s.length });
      parts.push(s);
      offset += s.length;
      return;
    }
    if (node instanceof Y.XmlElement || node instanceof Y.XmlFragment) {
      const children = node.toArray();
      children.forEach((child, i) => {
        visit(child as Y.XmlElement | Y.XmlText);
        // Block-level separator between paragraph-like elements.
        if (node instanceof Y.XmlFragment && i < children.length - 1) {
          parts.push("\n");
          offset += 1;
        }
      });
    }
  };

  visit(fragment);
  return { text: parts.join(""), leaves };
}

/** Map a global text offset to the leaf that contains it. */
function leafAt(flat: FlatDoc, offset: number): { leaf: Leaf; local: number } | null {
  for (const leaf of flat.leaves) {
    if (offset >= leaf.start && offset <= leaf.start + leaf.length) {
      return { leaf, local: offset - leaf.start };
    }
  }
  return null;
}

export function serializeRelPos(pos: Y.RelativePosition): SerializedRelativePosition {
  return toBase64(Y.encodeRelativePosition(pos));
}

export function deserializeRelPos(s: SerializedRelativePosition): Y.RelativePosition {
  return Y.decodeRelativePosition(fromBase64(s));
}

/**
 * Create a serialized relative anchor at a global text offset.
 * `assoc` -1 binds to the char before (good for range ends), 1 to the char
 * after (good for range starts) so the anchor keeps its intent under inserts.
 */
export function anchorAtOffset(
  flat: FlatDoc,
  offset: number,
  assoc: 1 | -1,
): SerializedRelativePosition | null {
  const hit = leafAt(flat, offset);
  if (!hit) return null;
  const rel = Y.createRelativePositionFromTypeIndex(hit.leaf.text, hit.local, assoc);
  return serializeRelPos(rel);
}

export interface ResolvedAnchor {
  leaf: Y.XmlText;
  index: number; // local index within the leaf
  /** Global offset in the current flattened doc, for range math. */
  globalOffset: number;
}

/** Resolve a serialized relative anchor against the current doc state. */
export function resolveAnchor(
  doc: Y.Doc,
  flat: FlatDoc,
  serialized: SerializedRelativePosition,
): ResolvedAnchor | null {
  const rel = deserializeRelPos(serialized);
  const abs = Y.createAbsolutePositionFromRelativePosition(rel, doc);
  if (!abs) return null;
  const leaf = flat.leaves.find((l) => l.text === abs.type);
  if (!leaf) return null;
  const index = Math.min(abs.index, leaf.length);
  return { leaf: leaf.text, index, globalOffset: leaf.start + index };
}

export interface LocatedRange {
  start: number;
  end: number;
}

/**
 * Locate `oldText` in the flat document unambiguously using surrounding
 * context. contextBefore/contextAfter disambiguate when oldText appears more
 * than once (PRD §4.2). Returns null if not found or still ambiguous.
 */
export function locateText(
  flatText: string,
  oldText: string,
  contextBefore: string,
  contextAfter: string,
): LocatedRange | null {
  // An empty oldText is only ever valid as "insert at the very start of a
  // genuinely empty document" (the whole-document-draft case) — never as a
  // free-floating insert into real content, which would be hopelessly
  // ambiguous (insert where, exactly?).
  if (oldText.length === 0) return flatText.length === 0 ? { start: 0, end: 0 } : null;
  const matches: number[] = [];
  let from = 0;
  for (;;) {
    const idx = flatText.indexOf(oldText, from);
    if (idx === -1) break;
    matches.push(idx);
    from = idx + 1;
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) {
    return { start: matches[0]!, end: matches[0]! + oldText.length };
  }

  // Disambiguate with context.
  const scored = matches.filter((idx) => {
    const before = flatText.slice(Math.max(0, idx - contextBefore.length), idx);
    const after = flatText.slice(idx + oldText.length, idx + oldText.length + contextAfter.length);
    const beforeOk = contextBefore.length === 0 || before.endsWith(contextBefore.slice(-Math.min(contextBefore.length, 40)));
    const afterOk = contextAfter.length === 0 || after.startsWith(contextAfter.slice(0, Math.min(contextAfter.length, 40)));
    return beforeOk && afterOk;
  });
  if (scored.length === 1) {
    return { start: scored[0]!, end: scored[0]! + oldText.length };
  }
  return null; // ambiguous — caller should drop the hunk and warn
}
