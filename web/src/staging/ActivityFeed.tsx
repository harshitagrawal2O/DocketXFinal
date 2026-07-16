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
    <div className="activity-feed">
      {proposals.length === 0 && (
        <div className="empty-state">
          <p className="empty-title">No proposals yet</p>
          <p className="muted">
            Ask Viki to draft or revise a clause. Every suggestion lands here as a reviewable
            diff — nothing touches the live document until you accept it.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <section className="feed-section">
          <h4 className="feed-section-title">Awaiting review</h4>
          {active.map((p) => (
            <ProposalCard key={p.id} proposal={p} role={role} />
          ))}
        </section>
      )}

      {resolved.length > 0 && (
        <section className="feed-section">
          <h4 className="feed-section-title">Resolved</h4>
          {resolved.map((p) => (
            <ProposalCard key={p.id} proposal={p} role={role} />
          ))}
        </section>
      )}
    </div>
  );
}
