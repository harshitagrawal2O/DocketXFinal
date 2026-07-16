import type { Citation, DiffProposal } from "./diff.js";

/**
 * SSE event stream for a Viki agent run (PRD §4.4, §6.3).
 * Invariant: no silent waits. Every run emits an intent line before work,
 * and a live run_state at each transition.
 */

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export type AgentSSEEvent =
  | { type: "run_state"; state: "thinking" | "drafting" | "self_checking" | "awaiting_review" }
  /** One line describing the action about to begin. Shown before any spinner. */
  | { type: "intent"; text: string }
  /** Decomposition of a multi-part request; ticks off live. */
  | { type: "checklist"; items: ChecklistItem[] }
  /** Token-level append to a proposal's newText. */
  | { type: "hunk_delta"; proposalId: string; delta: string }
  /** A proposal is fully generated and anchored; Accept may now enable. */
  | { type: "hunk_complete"; proposal: DiffProposal }
  /**
   * A hunk was blocked (e.g. citation verification failed) or dropped (e.g.
   * out of scope). proposalId lets the client discard any dangling
   * client-side streaming preview it had already built for this hunk via
   * hunk_delta — without this, a blocked hunk's live preview would stay
   * stuck in "streaming" forever since hunk_complete never arrives for it.
   */
  | { type: "hunk_blocked"; proposalId: string; hunkIndex: number; reason: string; citations: Citation[] }
  /** Viki needs a fact instead of inventing it. */
  | { type: "clarifying_question"; question: string }
  /**
   * Viki called a read-only research tool mid-run (cross-document lookup or
   * web/statute search) — surfaced live so the plan visibly adapts as Viki
   * finds things, instead of the user seeing a silent gap before the next
   * checklist update.
   */
  | { type: "tool_call"; tool: "search_documents" | "read_document" | "web_search"; detail: string }
  | { type: "run_complete"; agentRunId: string }
  | { type: "run_interrupted"; agentRunId: string }
  | { type: "error"; message: string };

/** Broadcast to all doc clients when a proposal changes outside a run (accept/reject/outdated). */
export type ProposalBroadcast =
  | { type: "proposal_upsert"; proposal: DiffProposal }
  | { type: "proposal_removed"; proposalId: string };
