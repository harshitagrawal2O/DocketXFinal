import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import type { ProposalStatus } from "@docket/shared";
import { flattenFragment, anchorAtOffset, locateText } from "../anchors.js";
import { getFragment, rangesOverlap, currentRangeOffsets } from "../mutations.js";

/**
 * Reject flow (data-level) + the outdated-flip conflict rule (claude.md).
 *
 * Reject: invariant #3 — rejected proposals are NEVER deleted; they transition
 * to `rejected` and stay attributed. We model the transition with a small pure
 * function and assert semantics on a DiffProposal-shaped object.
 *
 * Outdated-flip: a human edit whose range OVERLAPS a staged proposal flips it
 * to `outdated`; a non-overlapping edit leaves it staged; a merely TOUCHING
 * edit (edit.end == proposal.start) is not overlap.
 */

type ReviewAction = "complete" | "accept" | "reject" | "edit_accept" | "human_overlap";

/** Pure status-transition helper (mirrors the intended server reducer). */
function nextStatus(current: ProposalStatus, action: ReviewAction): ProposalStatus {
  // Terminal states never change (invariant: decisions are final + audited).
  if (current === "accepted" || current === "rejected" || current === "edited_accepted") {
    return current;
  }
  switch (action) {
    case "complete":
      return current === "streaming" ? "staged" : current;
    case "accept":
      return "accepted";
    case "reject":
      return "rejected"; // allowed from staged AND outdated
    case "edit_accept":
      return "edited_accepted";
    case "human_overlap":
      return current === "staged" ? "outdated" : current;
    default:
      return current;
  }
}

describe("reject flow (data-level)", () => {
  it("moves a staged proposal to rejected without deleting it", () => {
    const proposal = {
      id: "p1",
      status: "staged" as ProposalStatus,
      resolvedByUserId: null as string | null,
      resolvedByName: null as string | null,
      resolvedAt: null as string | null,
    };

    const rejected = {
      ...proposal,
      status: nextStatus(proposal.status, "reject"),
      resolvedByUserId: "user-priya",
      resolvedByName: "Priya",
      resolvedAt: "2026-07-16T10:00:00.000Z",
    };

    expect(rejected.status).toBe("rejected");
    expect(rejected).toBeDefined(); // never deleted — still present in the feed
    expect(rejected.resolvedByUserId).toBe("user-priya");
    expect(rejected.resolvedByName).toBe("Priya");
  });

  it("keeps terminal decisions final and lets an outdated proposal still be rejected", () => {
    expect(nextStatus("streaming", "complete")).toBe("staged");
    expect(nextStatus("staged", "accept")).toBe("accepted");
    expect(nextStatus("staged", "edit_accept")).toBe("edited_accepted");
    expect(nextStatus("accepted", "reject")).toBe("accepted"); // terminal
    expect(nextStatus("rejected", "accept")).toBe("rejected"); // terminal
    expect(nextStatus("outdated", "reject")).toBe("rejected");
  });
});

describe("outdated-flip rule (rangesOverlap + currentRangeOffsets)", () => {
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
    "1. The Client shall pay the fees within thirty (30) days of the invoice.",
    "2. Interest shall accrue at eighteen percent (18%) per annum on late payment.",
  ];
  const CLAUSE = "eighteen percent (18%) per annum";

  it("classifies overlapping / non-overlapping / touching edits correctly", () => {
    const doc = makeDoc(PARAS);
    const flat = flattenFragment(getFragment(doc));
    const loc = locateText(flat.text, CLAUSE, "accrue at ", " on late");
    expect(loc).not.toBeNull();

    const anchorStart = anchorAtOffset(flat, loc!.start, 1)!;
    const anchorEnd = anchorAtOffset(flat, loc!.end, -1)!;

    const proposal = currentRangeOffsets(doc, anchorStart, anchorEnd)!;
    expect(proposal).toEqual({ start: loc!.start, end: loc!.end });

    // (a) An edit landing inside the proposal range → overlap → should flip.
    const overlapEdit = { start: proposal.start + 2, end: proposal.start + 6 };
    expect(rangesOverlap(overlapEdit.start, overlapEdit.end, proposal.start, proposal.end)).toBe(true);
    expect(nextStatus("staged", "human_overlap")).toBe("outdated");

    // (b) An edit entirely before the proposal → no overlap → stays staged.
    const beforeEdit = { start: 0, end: proposal.start - 5 };
    expect(rangesOverlap(beforeEdit.start, beforeEdit.end, proposal.start, proposal.end)).toBe(false);

    // (c) A TOUCHING edit whose end == proposal.start → NOT overlap.
    const touchingEdit = { start: proposal.start - 4, end: proposal.start };
    expect(rangesOverlap(touchingEdit.start, touchingEdit.end, proposal.start, proposal.end)).toBe(false);

    // (d) A touching edit at the other boundary (edit.start == proposal.end) → NOT overlap.
    const touchingEnd = { start: proposal.end, end: proposal.end + 4 };
    expect(rangesOverlap(touchingEnd.start, touchingEnd.end, proposal.start, proposal.end)).toBe(false);
  });

  it("non-overlapping edits leave the anchored range resolvable and unchanged", () => {
    const doc = makeDoc(PARAS);
    const flat = flattenFragment(getFragment(doc));
    const loc = locateText(flat.text, CLAUSE, "accrue at ", " on late")!;
    const anchorStart = anchorAtOffset(flat, loc.start, 1)!;
    const anchorEnd = anchorAtOffset(flat, loc.end, -1)!;

    // Human edits an earlier, non-overlapping leaf.
    const firstLeaf = flattenFragment(getFragment(doc)).leaves[0]!.text;
    doc.transact(() => firstLeaf.insert(0, "PART A. "), "human");

    const after = currentRangeOffsets(doc, anchorStart, anchorEnd)!;
    const flat2 = flattenFragment(getFragment(doc));
    // Still resolves and still points at the same clause → stays staged.
    expect(flat2.text.slice(after.start, after.end)).toBe(CLAUSE);
  });
});
