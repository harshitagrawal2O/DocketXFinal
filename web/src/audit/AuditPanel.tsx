import { useCallback, useEffect, useState } from "react";
import type { AuditEventDTO } from "@docket/shared";
import { auditApi } from "@/lib/api";

const TYPE_LABEL: Record<AuditEventDTO["type"], string> = {
  agent_run_started: "Agent run started",
  agent_run_completed: "Agent run completed",
  agent_run_interrupted: "Agent run interrupted",
  proposal_staged: "Proposal staged",
  proposal_accepted: "Proposal accepted",
  proposal_rejected: "Proposal rejected",
  proposal_edited_accepted: "Proposal edited & accepted",
  proposal_outdated: "Proposal outdated",
  citation_blocked: "Citation blocked",
  human_edit_session: "Human edit session",
  version_saved: "Version saved",
  version_rollback: "Version rollback",
  role_changed: "Role changed",
};

const TYPES = Object.keys(TYPE_LABEL) as AuditEventDTO["type"][];

export function AuditPanel({ documentId }: { documentId: string }) {
  const [events, setEvents] = useState<AuditEventDTO[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [filterType, setFilterType] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const page = await auditApi.list(documentId, {
          type: filterType || undefined,
          cursor: reset ? undefined : (cursor ?? undefined),
        });
        setEvents((prev) => (reset ? page.events : [...prev, ...page.events]));
        setCursor(page.nextCursor);
      } catch {
        setError("Could not load the audit trail.");
      } finally {
        setLoading(false);
      }
    },
    [documentId, filterType, cursor],
  );

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, filterType]);

  function exportJson() {
    download(`audit-${documentId}.json`, JSON.stringify(events, null, 2), "application/json");
  }

  function exportCsv() {
    const header = ["id", "type", "userName", "createdAt", "proposalId", "agentRunId"];
    const lines = [header.join(",")];
    for (const e of events) {
      lines.push(
        [e.id, e.type, e.userName ?? "", e.createdAt, e.proposalId ?? "", e.agentRunId ?? ""]
          .map(csvCell)
          .join(","),
      );
    }
    download(`audit-${documentId}.csv`, lines.join("\n"), "text/csv");
  }

  return (
    <div className="audit-panel">
      <div className="audit-controls">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All events</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <div className="audit-export">
          <button className="btn btn-ghost btn-xs" disabled={events.length === 0} onClick={exportJson}>
            Export JSON
          </button>
          <button className="btn btn-ghost btn-xs" disabled={events.length === 0} onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      {error && <div className="error-line">{error}</div>}
      {events.length === 0 && !loading && !error && (
        <div className="empty-state sm">
          <p>No audit events{filterType ? " of this type" : ""} yet.</p>
        </div>
      )}

      <ol className="audit-timeline">
        {events.map((e) => (
          <li key={e.id} className="audit-event">
            <span className={`audit-dot audit-dot--${e.type}`} />
            <div className="audit-body">
              <div className="audit-line">
                <span className="audit-type">{TYPE_LABEL[e.type]}</span>
                {e.userName && <span className="audit-user">{e.userName}</span>}
              </div>
              <span className="muted audit-time">{new Date(e.createdAt).toLocaleString()}</span>
              {e.detail && Object.keys(e.detail).length > 0 && (
                <div className="audit-detail">
                  {Object.entries(e.detail).map(([k, v]) => (
                    <span key={k} className="audit-kv">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {loading && <div className="intent-line">Loading audit trail…</div>}
      {cursor && !loading && (
        <button className="btn btn-sm btn-block" onClick={() => void load(false)}>
          Load more
        </button>
      )}
    </div>
  );
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
