import { useState } from "react";
import type { Citation, DiffProposal, Role } from "@docket/shared";
import { can } from "@docket/shared";
import { useStaging } from "./StagingContext";
import { useAgent } from "@/agent/AgentContext";
import { flashDecoration } from "./flash";

const FILL_1 = { fontVariationSettings: "'FILL' 1" };

const STATUS_LABEL: Record<DiffProposal["status"], string> = {
  streaming: "Drafting",
  staged: "Awaiting review",
  accepted: "Accepted",
  rejected: "Rejected",
  edited_accepted: "Edited & accepted",
  outdated: "Outdated",
};

// Reconciled status-badge mapping (docs/STITCH_PATTERNS.md "Reconciled design
// decisions") — the ONE color system for the whole app. Do not reinvent.
const STATUS_BADGE_CLASS: Record<DiffProposal["status"], string> = {
  streaming: "bg-info-container text-info",
  staged: "bg-secondary-container text-on-secondary-container",
  accepted: "bg-success-container text-success",
  edited_accepted: "bg-success-container text-success",
  rejected: "bg-surface-container-highest text-on-surface-variant",
  outdated: "bg-error-container text-on-error-container",
};

const STATUS_ICON: Partial<Record<DiffProposal["status"], string>> = {
  accepted: "check_circle",
  edited_accepted: "check_circle",
  outdated: "history",
};

function StatusPill({ status }: { status: DiffProposal["status"] }) {
  const icon = STATUS_ICON[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-label-md uppercase tracking-tight ${STATUS_BADGE_CLASS[status]}`}
    >
      {icon && (
        <span className="material-symbols-outlined text-[12px]" style={FILL_1}>
          {icon}
        </span>
      )}
      {status === "streaming" && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-info" />
        </span>
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Card shell tone: brass shimmer while streaming, greyed shell while outdated,
 * error-tinted border when a citation is blocked, subdued once resolved. */
function cardShellClasses(
  status: DiffProposal["status"],
  opts: { active: boolean; hasBlockedCitation: boolean; isTerminal: boolean },
): string {
  const { active, hasBlockedCitation, isTerminal } = opts;
  const base = "relative rounded-lg border p-4 transition-all cursor-pointer";
  let tone: string;
  if (status === "streaming") {
    tone =
      "overflow-hidden border-t-2 border-t-brass border-x-outline-variant/40 border-b-outline-variant/40 bg-white shadow-[0_0_15px_rgba(154,123,79,0.15)]";
  } else if (status === "outdated") {
    tone = "border-outline-variant/50 bg-surface-container-lowest";
  } else if (hasBlockedCitation && !isTerminal) {
    tone = "border-error/30 bg-white";
  } else if (status === "rejected") {
    tone = "border-outline-variant/60 bg-surface-container-lowest";
  } else if (isTerminal) {
    tone = "border-outline-variant/50 bg-white opacity-90";
  } else {
    tone = "border-outline-variant bg-white hover:border-secondary hover:shadow-sm";
  }
  return [base, tone, active ? "outline outline-2 outline-brass outline-offset-1" : ""]
    .filter(Boolean)
    .join(" ");
}

function CitationRow({ c }: { c: Citation }) {
  if (c.verified === false) {
    return (
      <li className="flex w-full items-center gap-2 rounded bg-error-container/20 px-2 py-1.5">
        <span className="material-symbols-outlined shrink-0 text-[14px] text-error">block</span>
        <span className="text-[11px] font-label-md text-on-error-container">
          {c.verificationNote ?? c.label}
        </span>
      </li>
    );
  }
  if (c.verified === true) {
    return (
      <li className="flex w-fit items-center gap-2 rounded border border-outline-variant/30 bg-surface px-2 py-1">
        <span className="material-symbols-outlined text-[14px] text-secondary" style={FILL_1}>
          verified
        </span>
        <span className="text-[11px] font-label-md text-secondary">{c.label}</span>
      </li>
    );
  }
  return (
    <li className="flex w-fit items-center gap-2 rounded border border-outline-variant/30 bg-surface px-2 py-1">
      <span className="material-symbols-outlined text-[14px] text-outline">hourglass_empty</span>
      <span className="text-[11px] font-label-md text-outline">Checking…</span>
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

  const cardClass = cardShellClasses(proposal.status, { active, hasBlockedCitation, isTerminal });

  // Rejected cards stay visible but collapse (invariant #3) — never removed
  // from the DOM/list, just de-emphasized with a greyscale treatment.
  if (proposal.status === "rejected" && collapsed) {
    return (
      <div
        className="cursor-pointer rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-3 opacity-50 grayscale transition-all hover:opacity-80 hover:grayscale-0"
        onClick={activate}
        data-card-id={proposal.id}
      >
        <div className="flex items-center justify-between gap-2">
          <StatusPill status="rejected" />
          <button
            className="text-[11px] font-bold uppercase tracking-wide text-outline hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(false);
            }}
          >
            Show
          </button>
        </div>
        <p className="mt-2 truncate text-body-md text-on-surface-variant line-through">
          {proposal.reasoning || "(rejected proposal)"}
        </p>
      </div>
    );
  }

  return (
    <div className={cardClass} onClick={activate} data-card-id={proposal.id}>
      {isStreaming && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-brass/5" aria-hidden />
      )}

      <div className="relative mb-3 flex items-center justify-between gap-2">
        <StatusPill status={proposal.status} />
        <div className="flex items-center gap-2">
          {proposal.resolvedByName && isTerminal && (
            <span className="text-[10px] text-outline">by {proposal.resolvedByName}</span>
          )}
          {proposal.status === "rejected" && (
            <button
              className="text-[11px] font-bold uppercase tracking-wide text-outline hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed(true);
              }}
            >
              Hide
            </button>
          )}
        </div>
      </div>

      <div className={`relative space-y-3 ${isOutdated ? "opacity-40 grayscale" : ""}`}>
        {proposal.reasoning && (
          <p
            className={`flex items-start gap-1.5 text-body-md italic ${
              proposal.status === "rejected"
                ? "text-on-surface-variant line-through"
                : isTerminal
                  ? "text-on-surface-variant"
                  : "text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined mt-0.5 shrink-0 text-[14px] text-secondary">
              lightbulb
            </span>
            <span>{proposal.reasoning}</span>
          </p>
        )}

        <div className="space-y-1 rounded border-l-2 border-outline-variant bg-surface-container-low p-3 font-mono text-[13px] leading-relaxed">
          {proposal.oldText && (
            <span className="line-through bg-diff-removed-bg text-diff-removed-text">
              {proposal.oldText}
            </span>
          )}{" "}
          <span className="bg-diff-added-bg text-diff-added-text font-medium">
            {proposal.editedText ?? proposal.newText}
          </span>
          {isStreaming && (
            <span
              className="ml-0.5 inline-block h-3 w-0 border-l-2 border-brass align-middle cursor-blink"
              aria-hidden
            />
          )}
        </div>

        {proposal.citations.length > 0 && (
          <ul className="space-y-1.5">
            {proposal.citations.map((c, i) => (
              <CitationRow key={`${c.statute}-${i}`} c={c} />
            ))}
          </ul>
        )}

        {hasBlockedCitation && !isTerminal && (
          <div className="rounded border border-error/30 bg-error-container/20 p-2 text-[11px] text-on-error-container">
            Citation verification failed — this hunk cannot be accepted until it is re-run
            against a valid authority.
          </div>
        )}
      </div>

      {isOutdated ? (
        <div className="relative mt-3 flex justify-center">
          <button
            className="flex items-center gap-2 rounded border border-outline-variant bg-white px-3 py-1.5 shadow-sm transition-colors hover:border-secondary"
            onClick={(e) => {
              e.stopPropagation();
              agent.rerun(proposal);
            }}
            title="Start a fresh run on the current text"
          >
            <span className="material-symbols-outlined text-sm text-outline">history</span>
            <span className="text-[11px] font-bold uppercase tracking-tight text-outline">
              Outdated — re-run on current text
            </span>
          </button>
        </div>
      ) : editing ? (
        <div className="relative mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          <textarea
            className="w-full rounded border border-outline-variant bg-surface-container-lowest p-2 font-mono text-[13px] text-on-surface focus:border-brass focus:outline-none"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <button
              className="rounded border border-outline px-3 py-1.5 text-label-sm font-label-md text-on-surface-variant hover:bg-surface-container"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button
              className="rounded bg-primary px-3 py-1.5 text-label-sm font-label-md text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending}
              onClick={async () => {
                await staging.editAccept(proposal.id, editText);
                setEditing(false);
              }}
            >
              Save &amp; accept
            </button>
          </div>
        </div>
      ) : (
        !isTerminal && (
          <div className="relative mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              className="flex-1 rounded bg-primary py-1.5 text-label-sm font-label-md text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
              className="flex-1 rounded border border-outline py-1.5 text-label-sm font-label-md text-on-surface-variant transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canReview || pending}
              onClick={() => void staging.reject(proposal.id)}
            >
              Reject
            </button>
            <button
              className="rounded border border-outline p-1.5 text-outline transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isStreaming || !canReview || pending}
              title="Edit then accept"
              aria-label="Edit then accept"
              onClick={() => {
                setEditText(proposal.newText);
                setEditing(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
            </button>
          </div>
        )
      )}
    </div>
  );
}
