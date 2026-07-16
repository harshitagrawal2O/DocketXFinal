# Phase 4 — Multiplayer × Agent Concurrency Test Playbook

Phase 4 hardens the interaction between real-time multiplayer editing and agent
runs. These scenarios are the gate: the accept/reject/edit path rewrites legal
text and must never corrupt it, double-apply, or mis-attribute (claude.md #1,
#4, #6 and the conflict rule).

Legend: **[A]** automated (vitest, `server/src/yjs/__tests__/`), **[M]** manual
(two browser sessions + a Viki run against the seeded document).

## Setup

- Seed: `npm run db:seed` (creates the MSA document, users Priya/Arjun/Meera,
  5 proposals across runs A/B/C — see `server/prisma/seed.ts`).
- Open the seeded doc in two sessions: **Priya** (owner) and **Arjun** (editor).
- Keep the audit trail (`AuditEvent`) visible in a third pane.

## Scenario 1 — First-accept-wins attribution

Two reviewers act on the **same** staged hunk near-simultaneously.

- [M] Priya and Arjun both open hunk `seed-prop-a1` (interest-rate change). Priya
      clicks Accept a beat before Arjun.
- Expected: exactly one accept applies. The proposal reads `accepted` with
      `resolvedByUserId = Priya`, `resolvedByName = "Priya"`. Arjun's click is a
      no-op on an already-terminal proposal.
- [A] `reject-and-outdated.test.ts` → `nextStatus` proves terminal states are
      final: `nextStatus("accepted", "reject") === "accepted"`.
- Audit: exactly one `proposal_accepted` event with Priya's id + timestamp.

## Scenario 2 — Simultaneous-accept idempotency

The server must guarantee **one Yjs transaction and one AuditEvent** even if two
accept requests race.

- [M] Fire two Accept requests for the same hunk (e.g. double-click / two tabs).
- Expected: the text is replaced **once** (no doubled clause), one
      `proposal_accepted` audit row, one Yjs update broadcast.
- Server rule to verify: accept is guarded by a status check inside the same
      transaction that flips `staged → accepted`; a second request sees a
      non-`staged` status and returns the already-resolved proposal without
      re-applying `applyAccept`.
- [A] `accept-mutation.test.ts` proves a single `applyAccept` yields the correct
      text and drops `oldText`; the idempotency guard is the server-route
      concern layered on top (manual verify).

## Scenario 3 — Concurrent-edit-during-stream stress

A human types while Viki streams hunks against overlapping regions.

- [M] Arjun starts a document-scope Viki run; while `hunk_delta`s stream, Priya
      edits paragraphs both far from and adjacent to the hunk ranges.
- Expected:
  - Edits far from a hunk: the hunk stays `staged`; its relative anchors follow
    the shifted text (nothing corrupts).
  - Edit overlapping a hunk's range: the hunk flips to `outdated`, Accept is
    blocked, the card offers "re-run on current text" (conflict rule).
  - Live typing never freezes while tokens stream (SSE path independent of the
    Yjs/WS path — see phase-3-findings.md).
- [A] `anchor-stability.test.ts` proves anchors follow concurrent earlier edits;
      `reject-and-outdated.test.ts` proves the overlap → `outdated` classification
      via `rangesOverlap` + `currentRangeOffsets`, including the touching-edge
      case (`edit.end == proposal.start` is **not** overlap).

## Scenario 4 — Overlapping hunks from two runs

Two agent runs produce hunks whose ranges overlap; accepting one must flip the
other to `outdated`.

- [M] Run 1 proposes a change to a clause; Run 2 (later) proposes an overlapping
      change to the same clause. Accept Run 1's hunk.
- Expected: Run 1 hunk → `accepted` and applied; Run 2's overlapping hunk → its
      range now overlaps freshly-changed text → flips to `outdated`, Accept
      blocked, card stays visible with "re-run on current text". Run 2's
      non-overlapping hunks (if any) remain `staged`.
- Server rule to verify: after any accept, re-resolve every other `staged`
      proposal on the doc via `currentRangeOffsets` and apply the overlap test
      against the accepted range; flip overlappers to `outdated` and emit a
      `proposal_outdated` audit event each.
- [A] `reject-and-outdated.test.ts` covers the overlap/touching/non-overlap
      classification the flip logic is built on.

## Pass criteria

- No scenario produces doubled, dropped, or mis-placed clause text.
- Every accept/reject/edit-then-accept/outdated transition has exactly one
  attributed `AuditEvent` (append-only, #4).
- Rejected and outdated proposals remain visible — never deleted (#3).
- Multi-hunk runs remain independently acceptable/rejectable (#6).
