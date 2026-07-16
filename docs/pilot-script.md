# Phase 5 — Pilot Walkthrough Script

End-to-end script for the Docket v2 pilot: an owner creates a document, invites
collaborators, runs Viki, reviews the diffs three ways, confirms role limits,
and exercises the audit trail + version rollback. Run it against the seed
(`npm run db:seed`) or from scratch — both paths are noted.

Cast (matches `server/prisma/seed.ts`):

- **Priya Nair** — owner (`priya@docket.test`)
- **Arjun Mehta** — editor (`arjun@docket.test`)
- **Meera Rao** — commenter (`meera@docket.test`) — the reviewer who can comment
  but must not touch hunks

Document: *Master Services Agreement — Nradia Technologies & Korefield Analytics*
(synthetic Indian commercial contract; no real client data).

## 1. Owner creates the document and invites collaborators

1. Sign in as **Priya**. Create the MSA document (or open the seeded one).
2. Invite **Arjun** as **editor** and **Meera** as **commenter**.
3. Expected: each invite writes a `role_changed` (or membership) `AuditEvent`;
   both collaborators see the doc with their capabilities per
   `packages/shared/src/roles.ts`:
   - editor → edit, comment, run_agent, review, manage_versions
   - commenter → comment only

## 2. Editor runs Viki

1. As **Arjun**, open the contract and start a **document-scope** Viki run
   (e.g. "tighten the term, the late-payment interest, and confidentiality").
2. Watch the SSE stream (phase-3-findings.md): an `intent` line first, then
   `run_state` (`thinking → drafting → self_checking → awaiting_review`), then
   `hunk_delta` tokens streaming into staged cards. **Nothing touches the live
   document yet** (#1).
3. Expected result mirrors the seed's Run A: three independent staged hunks
   (term 12→24 months; interest 18%→12% with a verified *Indian Contract Act,
   1872, s. 73* citation; confidentiality survival period).
4. Also present from the seed: Run B's indemnity hunk carrying a **broken
   citation** (*Companies Act, 2013, s. 420* — actually an IPC section). Its card
   shows the verification failure and **Accept is blocked** (#5).

## 3. Review three ways

Reviewers: Priya (owner) or Arjun (editor).

1. **Accept** — Accept the interest-rate hunk (`seed-prop-a1`). Expected: one Yjs
   transaction replaces the clause text; proposal → `accepted` with the
   reviewer's name/id; one `proposal_accepted` audit row; collaborators see the
   change sync live.
2. **Reject** — Reject the broken-citation indemnity hunk (`seed-prop-b0`).
   Expected: proposal → `rejected`, **not deleted** — it stays in the activity
   feed, struck through and collapsible (#3); one `proposal_rejected` audit row.
3. **Edit-then-accept** — Open the term hunk (`seed-prop-a0`), tweak the
   replacement text (e.g. 24 → 18 months) in the card, then accept. Expected:
   `editedText` is stored, proposal → `edited_accepted`, the edited text (not the
   original `newText`) lands in the doc; one `proposal_edited_accepted` audit row.

At each step confirm attribution is visible in the UI ("Accepted by Priya").

## 4. Role limits (commenter cannot touch hunks)

1. Sign in as **Meera** (commenter).
2. Expected: Meera can open comment threads on the document, but the Accept /
   Reject / Edit controls on hunk cards are **absent/disabled**, and she cannot
   start a Viki run — `can("commenter", "review")` and
   `can("commenter", "run_agent")` are both false. Attempting the action via API
   is rejected server-side, not just hidden in the UI.

## 5. Owner views the audit trail and rolls back a version

1. As **Priya**, open the audit trail. Expected chronological, append-only
   events: agent run started/completed, proposal staged, the accept, the reject,
   the edit-then-accept, the `citation_blocked` on Run B, and version events —
   each with actor + timestamp, **no document contents** (#4, #7).
2. Roll back to the **"Baseline (seed)"** version:
   - Owner selects the baseline version (saved via
     `Y.encodeSnapshotV2(Y.snapshot(doc))`; gc is disabled so the snapshot
     reconstructs — see phase-0-findings.md).
   - Expected: `rollbackToSnapshot` re-applies the historical state as **new**
     edits tagged `"rollback"`; the accepted/edited changes are reverted in the
     live doc, but **history is preserved** — the prior version and all audit
     events remain. A `version_rollback` audit row is written.
3. Confirm collaborators see the rolled-back text sync live, and that a new
   version can be saved on top.

## Pass criteria

- Viki output only ever appears as staged proposals; the live doc changes only on
  explicit human Accept.
- Blocked-citation hunk cannot be accepted; rejected/outdated hunks stay visible.
- Every review action and version op is attributed in the append-only audit log.
- Rollback restores prior text without destroying history.
- Commenter cannot edit, review, or run the agent.
