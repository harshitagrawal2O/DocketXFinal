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

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  /** Presence color for CollaborationCursor. */
  color: string;
}
