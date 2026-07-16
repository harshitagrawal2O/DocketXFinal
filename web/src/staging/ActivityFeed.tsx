import type { Role } from "@docket/shared";
import { useStaging } from "./StagingContext";
import { ProposalCard } from "./ProposalCard";

export function ActivityFeed({ role }: { role: Role }) {
  const { proposals } = useStaging();

  const active = proposals.filter(
    (p) => p.status === "streaming" || p.status === "staged" || p.status === "outdated",
  );
  const resolved = proposals.filter(
    (p) =>
      p.status === "accepted" || p.status === "rejected" || p.status === "edited_accepted",
  );

  return (
    <div className="flex h-full flex-col bg-surface-container-low">
      <div className="flex items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[18px] text-secondary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          <h3 className="text-label-md font-label-md uppercase tracking-wider text-primary">
            Active Proposals ({active.length})
          </h3>
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
            {active.map((p) => (
              <ProposalCard key={p.id} proposal={p} role={role} />
            ))}
          </section>
        )}

        {resolved.length > 0 && (
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
    </div>
  );
}
