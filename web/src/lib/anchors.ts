import * as Y from "yjs";
import { fromBase64, toBase64 } from "lib0/buffer";
import {
  relativePositionToAbsolutePosition,
  absolutePositionToRelativePosition,
  ySyncPluginKey,
} from "y-prosemirror";
import type { EditorState } from "@tiptap/pm/state";
import type { SerializedRelativePosition } from "@docket/shared";

/**
 * The y-prosemirror binding object exposes exactly what we need to translate
 * between serialized Yjs relative positions and absolute ProseMirror offsets.
 * Absolute offsets are NEVER stored (claude.md core data model) — they break
 * the moment a collaborator edits. We resolve on demand every time.
 *
 * `mapping` is typed from y-prosemirror's own function signature so the exact
 * ProsemirrorMapping shape flows through without `any`.
 */
type ProsemirrorMapping = Parameters<typeof relativePositionToAbsolutePosition>[3];

export interface YBinding {
  type: Y.XmlFragment;
  mapping: ProsemirrorMapping;
  doc: Y.Doc;
}

/** Pull the live y-prosemirror binding out of the editor state, if ready. */
export function getBinding(state: EditorState): YBinding | null {
  const syncState = ySyncPluginKey.getState(state) as unknown as
    | { binding?: YBinding | null }
    | undefined;
  return syncState?.binding ?? null;
}

/**
 * Serialized relative position -> absolute ProseMirror position.
 * Returns null when the anchor can no longer be resolved (deleted text).
 */
export function relPosToAbsolute(
  binding: YBinding,
  serialized: SerializedRelativePosition,
): number | null {
  if (!serialized) return null;
  let relPos: Y.RelativePosition;
  try {
    relPos = Y.decodeRelativePosition(fromBase64(serialized));
  } catch {
    return null;
  }
  return relativePositionToAbsolutePosition(binding.doc, binding.type, relPos, binding.mapping);
}

/** Absolute ProseMirror position -> serialized relative position (base64). */
export function absoluteToRelPos(binding: YBinding, pos: number): SerializedRelativePosition {
  const relPos = absolutePositionToRelativePosition(pos, binding.type, binding.mapping);
  return toBase64(Y.encodeRelativePosition(relPos));
}

/** Resolve a proposal's [anchorStart, anchorEnd] to a normalized abs range. */
export function resolveProposalRange(
  binding: YBinding,
  anchorStart: SerializedRelativePosition,
  anchorEnd: SerializedRelativePosition,
): { from: number; to: number } | null {
  const a = relPosToAbsolute(binding, anchorStart);
  const b = relPosToAbsolute(binding, anchorEnd);
  if (a == null || b == null) return null;
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}
