import type { AgentRunScope, DiffProposal, AuditEventDTO } from "./diff.js";
import type { Role } from "./roles.js";

export interface StartAgentRunRequest {
  instruction: string;
  scope: AgentRunScope;
  /** Serialized relative positions bounding a selection-scoped run. */
  selectionAnchors?: { start: string; end: string };
  /** Answer to a prior clarifying question, resuming the run's context. */
  resumeRunId?: string;
  answer?: string;
}

export interface StartAgentRunResponse {
  agentRunId: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  kind: "contract" | "opinion" | "filing" | "memo";
  myRole: Role;
  updatedAt: string;
  /** Derived, not stored: "in_review" if any staged/streaming proposal exists, else "draft". */
  status: "draft" | "in_review";
}

export interface ProposalActionResult {
  proposal: DiffProposal;
}

export interface VersionSummary {
  id: string;
  documentId: string;
  name: string;
  auto: boolean;
  createdAt: string;
  createdByName?: string | null;
}

export interface AuditPage {
  events: AuditEventDTO[];
  nextCursor?: string | null;
}

/**
 * A distilled turn in Viki's persistent conversation on a document — spans
 * separate runs, so a follow-up instruction has real context (see
 * server/src/agent/conversation.ts). content is always plain text, never a
 * raw provider tool-call payload.
 */
export interface AgentTurnDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentRunId?: string | null;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  /** Presence color for CollaborationCursor. */
  color: string;
}
