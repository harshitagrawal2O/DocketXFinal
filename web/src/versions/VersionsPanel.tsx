import { useEffect, useState } from "react";
import type { Role, VersionSummary } from "@docket/shared";
import { can } from "@docket/shared";
import { versionsApi } from "@/lib/api";
import { lineDiff } from "./lineDiff";

export function VersionsPanel({ documentId, role }: { documentId: string; role: Role }) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [diff, setDiff] = useState<{ fromText: string; toText: string } | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);
  const canManage = can(role, "manage_versions");

  async function load() {
    try {
      setVersions(await versionsApi.list(documentId));
    } catch {
      setError("Could not load versions.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function save() {
    const name = window.prompt("Name this version", `Draft ${new Date().toLocaleString()}`);
    if (!name) return;
    setBusy(true);
    try {
      const v = await versionsApi.save(documentId, name);
      setVersions((prev) => [v, ...(prev ?? [])]);
    } catch {
      setError("Could not save version.");
    } finally {
      setBusy(false);
    }
  }

  async function runDiff() {
    if (!from || !to) return;
    setDiffBusy(true);
    try {
      setDiff(await versionsApi.diff(documentId, from, to));
    } catch {
      setError("Could not compute diff.");
    } finally {
      setDiffBusy(false);
    }
  }

  async function rollback(vid: string) {
    if (!window.confirm("Roll back to this version? A new version will be created.")) return;
    setBusy(true);
    try {
      const v = await versionsApi.rollback(documentId, vid);
      setVersions((prev) => [v, ...(prev ?? [])]);
    } catch {
      setError("Could not roll back.");
    } finally {
      setBusy(false);
    }
  }

  const rows = lineDiff(diff?.fromText ?? "", diff?.toText ?? "");

  return (
    <div className="versions-panel">
      <div className="panel-actions">
        <button className="btn btn-primary btn-sm" disabled={!canManage || busy} onClick={save}>
          Save version
        </button>
      </div>

      {error && <div className="error-line">{error}</div>}
      {versions === null && !error && <div className="intent-line">Loading versions…</div>}
      {versions && versions.length === 0 && (
        <div className="empty-state sm">
          <p>No saved versions.</p>
          <p className="muted">Save a version to snapshot the document at this point.</p>
        </div>
      )}

      {versions && versions.length > 0 && (
        <>
          <div className="diff-controls">
            <label>
              From
              <select value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">—</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              To
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">—</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-sm" disabled={!from || !to || diffBusy} onClick={runDiff}>
              {diffBusy ? "Diffing…" : "Compare"}
            </button>
          </div>

          {diff && (
            <div className="line-diff">
              {rows.map((r, i) => (
                <div key={i} className={`ld-row ld-${r.kind}`}>
                  <span className="ld-sign">
                    {r.kind === "add" ? "+" : r.kind === "del" ? "−" : " "}
                  </span>
                  <span className="ld-text">{r.text || " "}</span>
                </div>
              ))}
            </div>
          )}

          <ul className="version-list">
            {versions.map((v) => (
              <li key={v.id} className="version-row">
                <div className="version-meta">
                  <span className="version-name">{v.name}</span>
                  <span className="muted">
                    {v.auto ? "auto" : "manual"} · {new Date(v.createdAt).toLocaleString()}
                    {v.createdByName ? ` · ${v.createdByName}` : ""}
                  </span>
                </div>
                <button
                  className="btn btn-ghost btn-xs"
                  disabled={!canManage || busy}
                  onClick={() => rollback(v.id)}
                >
                  Roll back
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
