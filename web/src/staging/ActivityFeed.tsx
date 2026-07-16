import { useState } from "react";
import type { Role } from "@docket/shared";
import { can } from "@docket/shared";
import { useStaging } from "./StagingContext";
import { ProposalCard } from "./ProposalCard";

const FILL_1 = { fontVariationSettings: "'FILL' 1" };

export function ActivityFeed({ role }: { role: Role }) {
  const staging = useStaging();
  const { proposals } = staging;
  const [showResolved, setShowResolved] = useState(true);
  const [applying, setApplying] = useState(false);
  const canReview = can(role, "review");

  const active = proposals.filter(
    (p) => p.status === "streaming" || p.status === "staged" || p.status === "outdated",
  );
  const resolved = proposals.filter(
    (p) =>
      p.status === "accepted" || p.status === "rejected" || p.status === "edited_accepted",
  );
  // Eligible for a one-click bulk accept: fully staged, no blocked citation.
  const acceptableIds = active
    .filter((p) => p.status === "staged" && !p.citations.some((c) => c.verified === false))
    .map((p) => p.id);

  async function applyAllProposed() {
    if (applying || acceptableIds.length === 0) return;
    setApplying(true);
    try {
      for (const id of acceptableIds) {
        await staging.accept(id);
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-surface-container-low">
      <div className="flex items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[18px] text-secondary"
            style={FILL_1}
          >
            auto_awesome
          </span>
          <h3 className="text-label-md font-label-md uppercase tracking-wider text-primary">
            Viki AI Proposals
          </h3>
        </div>
        <div className="flex items-center gap-1 text-outline">
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            aria-pressed={showResolved}
            title={showResolved ? "Hide resolved proposals" : "Show resolved proposals"}
            className={`rounded p-1 transition-colors hover:bg-surface-container-high hover:text-primary ${
              showResolved ? "text-primary" : ""
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
          </button>
          <button
            type="button"
            onClick={() => void staging.refresh()}
            disabled={staging.refreshing}
            title="Resync with the server"
            className="rounded p-1 transition-colors hover:bg-surface-container-high hover:text-primary disabled:opacity-40"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${staging.refreshing ? "animate-spin" : ""}`}
            >
              refresh
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 no-scrollbar">
        {proposals.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-outline-variant">
              auto_awesome
            </span>
            <p className="text-body-md font-medium text-on-surface">No proposals yet</p>
            <p className="text-label-sm text-on-surface-variant">
              Ask Viki to draft or revise a clause. Every suggestion lands here as a reviewable
              diff — nothing touches the live document until you accept it.
            </p>
          </div>
        )}

        {active.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-outline-variant" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-outline">
                Active Proposals ({active.length})
              </span>
              <div className="h-px flex-1 bg-outline-variant" />
            </div>
            {active.map((p) => (
              <ProposalCard key={p.id} proposal={p} role={role} />
            ))}
          </section>
        )}

        {resolved.length > 0 && showResolved && (
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-outline-variant" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-outline">
                Resolved ({resolved.length})
              </span>
              <div className="h-px flex-1 bg-outline-variant" />
            </div>
            {resolved.map((p) => (
              <ProposalCard key={p.id} proposal={p} role={role} />
            ))}
          </section>
        )}
      </div>

      {canReview && active.length > 0 && (
        <div className="border-t border-outline-variant bg-surface-container-lowest p-4">
          <button
            type="button"
            onClick={() => void applyAllProposed()}
            disabled={applying || acceptableIds.length === 0}
            title={
              acceptableIds.length === 0
                ? "Nothing is fully staged and clear to accept yet"
                : undefined
            }
            className="flex w-full items-center justify-center gap-2 rounded bg-secondary py-2.5 text-label-md font-label-md text-on-secondary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">done_all</span>
            {applying
              ? "Applying…"
              : `Apply All Proposed${acceptableIds.length ? ` (${acceptableIds.length})` : ""}`}
          </button>
          <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-outline">
            Powered by Viki
          </p>
        </div>
      )}
    </div>
  );
}
