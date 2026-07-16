import { useState } from "react";
import type { Citation, DiffProposal, Role } from "@docket/shared";
import { can } from "@docket/shared";
import { useStaging } from "./StagingContext";
import { useAgent } from "@/agent/AgentContext";
import { flashDecoration } from "./flash";

const STATUS_LABEL: Record<DiffProposal["status"], string> = {
  streaming: "Drafting…",
  staged: "Awaiting review",
  accepted: "Accepted",
  rejected: "Rejected",
  edited_accepted: "Edited & accepted",
  outdated: "Outdated",
};

function CitationRow({ c }: { c: Citation }) {
  const state = c.verified === true ? "verified" : c.verified === false ? "blocked" : "pending";
  const label =
    state === "verified" ? "Verified" : state === "blocked" ? "Blocked" : "Checking…";
  return (
    <li className={`citation citation--${state}`}>
      <span className="citation-label">{c.label}</span>
      <span className={`citation-badge citation-badge--${state}`}>{label}</span>
      {state === "blocked" && c.verificationNote && (
        <span className="citation-note">{c.verificationNote}</span>
      )}
    </li>
  );
}

export function ProposalCard({ proposal, role }: { proposal: DiffProposal; role: Role }) {
  const staging = useStaging();
  const agent = useAgent();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(proposal.newText);
  const [collapsed, setCollapsed] = useState(proposal.status === "rejected");

  const isTerminal =
    proposal.status === "accepted" ||
    proposal.status === "rejected" ||
    proposal.status === "edited_accepted";
  const isStreaming = proposal.status === "streaming";
  const isOutdated = proposal.status === "outdated";
  const hasBlockedCitation = proposal.citations.some((c) => c.verified === false);
  const canReview = can(role, "review");
  const pending = staging.pendingId === proposal.id;
  const active = staging.activeId === proposal.id;

  // Accept is disabled while streaming or outdated (invariant #2 / conflict rule),
  // when a citation is blocked (invariant #5), or without review capability.
  const acceptDisabled =
    isStreaming || isOutdated || hasBlockedCitation || !canReview || pending;

  function activate() {
    staging.setActive(proposal.id);
    flashDecoration(proposal.id);
  }

  const cardClass = [
    "hunk-card",
    `hunk-card--${proposal.status}`,
    active ? "is-active" : "",
    hasBlockedCitation ? "hunk-card--blocked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Rejected cards stay visible but collapse (invariant #3).
  if (proposal.status === "rejected" && collapsed) {
    return (
      <div className={cardClass} onClick={activate}>
        <div className="hunk-head">
          <span className="hunk-status hunk-status--rejected">Rejected</span>
          <button
            className="btn btn-ghost btn-xs"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(false);
            }}
          >
            Show
          </button>
        </div>
        <p className="hunk-reasoning struck">{proposal.reasoning || "(rejected proposal)"}</p>
      </div>
    );
  }

  return (
    <div className={cardClass} onClick={activate} data-card-id={proposal.id}>
      <div className="hunk-head">
        <span className={`hunk-status hunk-status--${proposal.status}`}>
          {STATUS_LABEL[proposal.status]}
          {isStreaming && <span className="dot-pulse" aria-hidden />}
        </span>
        {proposal.resolvedByName && isTerminal && (
          <span className="hunk-attrib">by {proposal.resolvedByName}</span>
        )}
        {proposal.status === "rejected" && (
          <button
            className="btn btn-ghost btn-xs"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(true);
            }}
          >
            Hide
          </button>
        )}
      </div>

      {proposal.reasoning && (
        <p className={`hunk-reasoning${isTerminal ? " struck-soft" : ""}`}>
          {proposal.reasoning}
        </p>
      )}

      <div className="hunk-diff">
        {proposal.oldText && (
          <div className="diff-line diff-old">
            <span className="diff-sign">−</span>
            <span className="diff-text">{proposal.oldText}</span>
          </div>
        )}
        <div className="diff-line diff-new">
          <span className="diff-sign">+</span>
          <span className="diff-text">
            {proposal.editedText ?? proposal.newText}
            {isStreaming && <span className="caret" aria-hidden />}
          </span>
        </div>
      </div>

      {proposal.citations.length > 0 && (
        <ul className="citation-list">
          {proposal.citations.map((c, i) => (
            <CitationRow key={`${c.statute}-${i}`} c={c} />
          ))}
        </ul>
      )}

      {hasBlockedCitation && !isTerminal && (
        <div className="hunk-blocked-note">
          Citation verification failed — this hunk cannot be accepted until it is re-run
          against a valid authority.
        </div>
      )}

      {editing ? (
        <div className="hunk-edit" onClick={(e) => e.stopPropagation()}>
          <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={4} />
          <div className="hunk-actions">
            <button className="btn btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={pending}
              onClick={async () => {
                await staging.editAccept(proposal.id, editText);
                setEditing(false);
              }}
            >
              Save & accept
            </button>
          </div>
        </div>
      ) : (
        !isTerminal && (
          <div className="hunk-actions" onClick={(e) => e.stopPropagation()}>
            {isOutdated ? (
              <>
                <button className="btn btn-sm" disabled title="This hunk is outdated">
                  Accept
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => agent.rerun(proposal)}
                  title="Start a fresh run on the current text"
                >
                  Re-run on current text
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-accept btn-sm"
                  disabled={acceptDisabled}
                  title={
                    isStreaming
                      ? "Wait for the hunk to finish"
                      : hasBlockedCitation
                        ? "Blocked by citation check"
                        : undefined
                  }
                  onClick={() => void staging.accept(proposal.id)}
                >
                  Accept
                </button>
                <button
                  className="btn btn-reject btn-sm"
                  disabled={!canReview || pending}
                  onClick={() => void staging.reject(proposal.id)}
                >
                  Reject
                </button>
                <button
                  className="btn btn-sm"
                  disabled={isStreaming || !canReview || pending}
                  onClick={() => {
                    setEditText(proposal.newText);
                    setEditing(true);
                  }}
                >
                  Edit then accept
                </button>
              </>
            )}
          </div>
        )
      )}
    </div>
  );
}
