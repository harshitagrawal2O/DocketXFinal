# Phase 3 — Streaming & Latency Findings

Phase 3 covers Viki's SSE stream into the staging layer and the "no silent
waits" invariant (claude.md #2). This file is the findings template to fill in
as the streaming path is exercised; the event contract and audit checks below
are fixed.

## SSE event contract

Source of truth: `packages/shared/src/events.ts` (`AgentSSEEvent`). Every agent
run emits, in order:

| Event | Purpose | Invariant it satisfies |
| --- | --- | --- |
| `intent` | One line describing the action **before** any work/spinner | #2 no silent waits |
| `run_state` | `thinking → drafting → self_checking → awaiting_review` | live state, never blank |
| `checklist` | Decomposition of a multi-part request; ticks off live | multi-clause visibility |
| `hunk_delta` | Token-level append to a proposal's `newText` | streams into the *staged* diff, never the live doc (#1) |
| `hunk_complete` | A proposal is fully generated + anchored; Accept may enable | #6 independent hunks |
| `hunk_blocked` | A hunk failed a gate (e.g. citation verification) | #5 citation guardrail |
| `clarifying_question` | Viki needs a fact rather than inventing one | #5 no invented facts |
| `run_complete` / `run_interrupted` | Terminal state of the run | run is always resolved |
| `error` | Transport / model error surfaced to the UI | never hangs blank |

Broadcast outside a run (accept/reject/outdated changes made by a human):
`ProposalBroadcast` (`proposal_upsert` / `proposal_removed`).

### Findings to record (fill in during Phase 3 runs)

- Time-to-first-`intent` (ms): ____
- Time-to-first-`hunk_delta` (ms): ____
- Median inter-token delta (ms): ____
- Full-run wall time for a 3-hunk run: ____

## "No spinner without an intent line" audit

Rule: **a spinner may never appear before an `intent` line.** The UI must render
the intent text first, then the `run_state`, then the spinner is only a decoration
on an already-labeled state. Audit checklist:

- [ ] `intent` is the first event on the stream (before any `run_state`).
- [ ] Every `run_state` transition has a visible label; the spinner is attached
      to a named state, never floating on its own.
- [ ] `hunk_delta` tokens render into the staged card immediately — the live
      document is untouched until an explicit human Accept (#1).
- [ ] `hunk_blocked` renders an error card with the citation reason; Accept stays
      disabled for that hunk.
- [ ] `clarifying_question` pauses the run with a visible prompt — no blank wait.
- [ ] `run_interrupted` / `error` always leave a terminal, readable state.

## Slow-3G degradation (the Indian-network check)

Target: on a throttled Slow-3G connection the experience **degrades gracefully —
states stay visible and nothing ever hangs on a blank screen.**

Expected behavior to verify (DevTools → Network → Slow 3G):

- The `intent` line and the current `run_state` appear and remain on screen even
  when tokens arrive slowly or in bursts — the user always knows what Viki is
  doing.
- `hunk_delta` batching under high latency still renders incrementally; the card
  shows partial `newText` rather than an all-or-nothing pop-in.
- If the SSE connection drops, the client shows a reconnecting state (not a blank
  panel) and resumes or offers "re-run on current text"; the partial proposal is
  never silently lost or auto-accepted.
- The live Yjs/WebSocket editing path and the SSE agent path are independent: a
  slow agent stream must not freeze collaborative typing.
- No component blocks the main thread waiting on a full response (#2); every
  await has a visible pending state.

### Findings to record

- Slow-3G time-to-first-`intent`: ____
- Behavior on forced SSE disconnect mid-stream: ____
- Any blank-screen or hang observed: ____ (must be none to pass the gate)
