/**
 * The staging object and single source of truth for both renderings
 * (activity-feed hunk card + in-editor decoration). See claude.md "Core data model".
 */

export type ProposalStatus =
  | "streaming" // tokens still arriving; Accept disabled
  | "staged" // fully generated, awaiting review
  | "accepted"
  | "rejected"
  | "edited_accepted"
  | "outdated"; // a human edit overlapped the range; must be re-run

export interface Citation {
  /** Human-readable label, e.g. "Indian Contract Act, 1872, s. 73". */
  label: string;
  /** Statute / act identifier used by the verifier. */
  statute: string;
  /** Section reference, e.g. "73". */
  section?: string;
  /** Whether citation verification passed. Null until verified. */
  verified: boolean | null;
  /** Reason a citation failed verification (surfaced on an error card). */
  verificationNote?: string;
}

/**
 * Serialized Yjs RELATIVE position. Never store absolute offsets — they break
 * the moment anyone else edits the doc. Produced by
 * Y.createRelativePositionFromTypeIndex and encoded to base64.
 */
export type SerializedRelativePosition = string;

export interface DiffProposal {
  id: string;
  documentId: string;
  agentRunId: string;

  anchorStart: SerializedRelativePosition;
  anchorEnd: SerializedRelativePosition;

  oldText: string;
  newText: string;
  editedText?: string | null; // set on edit-then-accept

  reasoning: string;
  citations: Citation[];

  status: ProposalStatus;

  createdAt: string; // ISO
  resolvedAt?: string | null;
  resolvedByUserId?: string | null;
  resolvedByName?: string | null; // for live attribution ("Accepted by Priya")

  /** Ordering within a multi-hunk run. */
  hunkIndex: number;
}

/** What Viki emits per hunk before anchors are resolved server-side. */
export interface RawHunk {
  oldText: string;
  newText: string;
  contextBefore: string;
  contextAfter: string;
  reasoning: string;
  citations: Citation[];
}

export type AgentRunScope = "document" | "selection";
export type AgentRunStatus =
  | "thinking"
  | "drafting"
  | "self_checking"
  | "awaiting_review"
  | "complete"
  | "interrupted"
  | "error";

export interface AuditEventDTO {
  id: string;
  documentId: string;
  type:
    | "agent_run_started"
    | "agent_run_completed"
    | "agent_run_interrupted"
    | "proposal_staged"
    | "proposal_accepted"
    | "proposal_rejected"
    | "proposal_edited_accepted"
    | "proposal_outdated"
    | "citation_blocked"
    | "human_edit_session"
    | "version_saved"
    | "version_rollback"
    | "role_changed";
  userId?: string | null;
  userName?: string | null;
  proposalId?: string | null;
  agentRunId?: string | null;
  /** Non-privileged metadata only. NEVER document contents. */
  detail?: Record<string, string | number | boolean | null>;
  createdAt: string;
}
