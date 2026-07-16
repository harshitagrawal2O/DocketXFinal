import { useCallback, useEffect, useState } from "react";
import type { AuditEventDTO } from "@docket/shared";
import { auditApi, docsApi } from "@/lib/api";

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

/**
 * The ONE status/type color mapping for the whole app — see
 * docs/STITCH_PATTERNS.md "Reconciled design decisions" > "Status badge".
 * agent_run_started/completed -> info; agent_run_interrupted -> neutral;
 * proposal_staged sits in the general "Draft/staged" amber bucket;
 * accepted/edited_accepted -> success; rejected/outdated/citation_blocked
 * and version_rollback -> error; the rest -> neutral.
 */
const TYPE_BADGE: Record<AuditEventDTO["type"], string> = {
  agent_run_started: "bg-info-container text-info",
  agent_run_completed: "bg-info-container text-info",
  agent_run_interrupted: "bg-surface-container-highest text-on-surface-variant",
  proposal_staged: "bg-secondary-container text-on-secondary-container",
  proposal_accepted: "bg-success-container text-success",
  proposal_edited_accepted: "bg-success-container text-success",
  proposal_rejected: "bg-error-container text-on-error-container",
  proposal_outdated: "bg-error-container text-on-error-container",
  citation_blocked: "bg-error-container text-on-error-container",
  human_edit_session: "bg-surface-container-highest text-on-surface-variant",
  version_saved: "bg-surface-container-highest text-on-surface-variant",
  version_rollback: "bg-error-container text-on-error-container",
  role_changed: "bg-surface-container-highest text-on-surface-variant",
};

// Deterministic fallback avatar color for a human actor whose real presence
// color isn't available (e.g. they've since left the document).
const AVATAR_FALLBACK_PALETTE = [
  "#2F6F5B",
  "#1E4D7B",
  "#9A7B4F",
  "#7C3AED",
  "#B45309",
  "#0F766E",
  "#BE185D",
  "#4338CA",
];

function fallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_FALLBACK_PALETTE[hash % AVATAR_FALLBACK_PALETTE.length]!;
}

/** "Siddharth Rao" -> "SR"; single-word names take the first two letters. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function AuditPanel({ documentId }: { documentId: string }) {
  const [events, setEvents] = useState<AuditEventDTO[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [filterType, setFilterType] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberColors, setMemberColors] = useState<Map<string, string>>(new Map());

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

  // Real per-person presence color (same field used for collaboration cursors
  // and the sharing modal) for human actor avatars; a member who has since
  // left the document falls back to a deterministic color instead.
  useEffect(() => {
    docsApi
      .get(documentId)
      .then((d) => {
        setMemberColors(new Map(d.members.map((m): [string, string] => [m.userId, m.color])));
      })
      .catch(() => {
        /* Non-fatal — actor avatars fall back to a deterministic color. */
      });
  }, [documentId]);

  function colorFor(userId: string | null | undefined, name: string): string {
    if (userId) {
      const real = memberColors.get(userId);
      if (real) return real;
    }
    return fallbackColor(name);
  }

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
    <div className="flex h-full flex-col bg-surface">
      {/* Filter bar + export actions */}
      <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant bg-surface-container-low p-stack-md">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-label-md uppercase text-on-surface-variant">
            Filter by
          </span>
          <select
            className="rounded-sm border border-outline-variant bg-white px-3 py-1.5 font-label-md text-label-md text-primary focus:border-primary focus:outline-none"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All event types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-label-md text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span>
            {events.length} event{events.length === 1 ? "" : "s"} loaded
          </span>
        </div>

        <div className="ml-auto flex gap-3">
          <button
            className="flex items-center gap-2 rounded-sm border border-outline-variant px-4 py-2 font-label-md text-label-md text-primary transition-all hover:bg-surface-container-high active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={events.length === 0}
            onClick={exportCsv}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <button
            className="flex items-center gap-2 rounded-sm bg-primary-container px-4 py-2 font-label-md text-label-md text-on-primary transition-all hover:bg-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={events.length === 0}
            onClick={exportJson}
          >
            <span className="material-symbols-outlined text-[18px]">terminal</span>
            Export JSON
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-error-container px-stack-md py-2 text-body-md text-on-error-container">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {events.length === 0 && !loading && !error && (
        <div className="py-stack-lg text-center text-on-surface-variant">
          <p className="font-body-md text-body-md">
            No audit events{filterType ? " of this type" : ""} yet.
          </p>
        </div>
      )}

      {/* Ledger table */}
      {events.length > 0 && (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container">
                <th className="w-48 p-3 text-[11px] font-label-md uppercase text-on-surface-variant">
                  Timestamp
                </th>
                <th className="w-48 p-3 text-[11px] font-label-md uppercase text-on-surface-variant">
                  Actor
                </th>
                <th className="w-40 p-3 text-[11px] font-label-md uppercase text-on-surface-variant">
                  Event type
                </th>
                <th className="p-3 text-[11px] font-label-md uppercase text-on-surface-variant">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const userName = e.userName;
                const detailEntries = e.detail ? Object.entries(e.detail) : [];
                return (
                  <tr
                    key={e.id}
                    className="border-b border-outline-variant transition-colors even:bg-surface-container-low hover:bg-surface-container-high"
                  >
                    <td className="whitespace-nowrap p-3 font-mono text-[13px] text-primary">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {userName ? (
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: colorFor(e.userId, userName) }}
                          >
                            {initials(userName)}
                          </div>
                          <span className="font-label-md text-primary">{userName}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-container">
                            <span className="material-symbols-outlined text-[14px] text-white">
                              smart_toy
                            </span>
                          </div>
                          <span className="font-label-md text-primary">Viki AI Agent</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-sm px-2 py-0.5 text-[11px] font-label-md uppercase tracking-tight ${TYPE_BADGE[e.type]}`}
                      >
                        {TYPE_LABEL[e.type]}
                      </span>
                    </td>
                    <td className="p-3 text-body-md text-on-surface">
                      {detailEntries.length === 0 ? (
                        <span className="text-on-surface-variant">—</span>
                      ) : (
                        detailEntries.map(([k, v]) => (
                          <span key={k} className="mr-3 inline-block">
                            <span className="text-on-surface-variant">{k}:</span> {String(v)}
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loading && (
        <div className="p-stack-md text-center italic text-body-md text-on-surface-variant">
          Loading audit trail…
        </div>
      )}

      {cursor && !loading && (
        <div className="border-t border-outline-variant p-stack-md">
          <button
            className="w-full rounded border border-outline-variant py-2.5 font-label-md text-label-md text-on-surface-variant transition-all hover:bg-surface-container-high"
            onClick={() => void load(false)}
          >
            Load more
          </button>
        </div>
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
