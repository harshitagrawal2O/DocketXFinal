import { useEffect, useState } from "react";
import type { Role, VersionSummary } from "@docket/shared";
import { can } from "@docket/shared";
import { versionsApi } from "@/lib/api";
import { lineDiff } from "./lineDiff";

/** "S. Rao" -> "SR"; single-word names take the first two letters. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

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
    <div className="flex h-full flex-col bg-surface">
      <div className="flex-1 space-y-stack-lg overflow-y-auto p-stack-md">
        {error && (
          <div className="flex items-center gap-2 rounded bg-error-container px-3 py-2 text-body-md text-on-error-container">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        {versions === null && !error && (
          <div className="p-stack-md text-center italic text-body-md text-on-surface-variant">
            Loading versions…
          </div>
        )}

        {versions && versions.length === 0 && (
          <div className="py-stack-lg text-center text-on-surface-variant">
            <p className="font-body-md text-body-md">No saved versions.</p>
            <p className="mt-1 font-label-sm text-label-sm">
              Save a version to snapshot the document at this point.
            </p>
          </div>
        )}

        {versions && versions.length > 0 && (
          <>
            {/* Compare controls */}
            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-stack-sm">
              <span className="mb-2 block font-label-md text-label-md text-on-surface-variant">
                COMPARE VERSIONS
              </span>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">From</span>
                  <select
                    className="rounded border border-outline-variant bg-surface px-2 py-1.5 text-body-md text-on-surface focus:border-primary focus:outline-none"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  >
                    <option value="">—</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">To</span>
                  <select
                    className="rounded border border-outline-variant bg-surface px-2 py-1.5 text-body-md text-on-surface focus:border-primary focus:outline-none"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  >
                    <option value="">—</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="rounded bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!from || !to || diffBusy}
                  onClick={() => void runDiff()}
                >
                  {diffBusy ? "Diffing…" : "Compare"}
                </button>
              </div>
            </div>

            {/* Diff result — one shared treatment with the AI-proposal hunk cards
                (docs/STITCH_PATTERNS.md "Reconciled design decisions"). */}
            {diff && (
              <div className="max-h-[420px] space-y-1 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-stack-md font-body-md text-body-md leading-relaxed text-on-surface">
                {rows.length === 0 && (
                  <p className="italic text-on-surface-variant">No textual differences.</p>
                )}
                {rows.map((r, i) => {
                  if (r.kind === "same") {
                    return <p key={i}>{r.text || " "}</p>;
                  }
                  if (r.kind === "del") {
                    return (
                      <p key={i}>
                        <span className="rounded bg-diff-removed-bg px-1 text-diff-removed-text line-through">
                          {r.text || " "}
                        </span>
                      </p>
                    );
                  }
                  return (
                    <p key={i}>
                      <span className="rounded bg-diff-added-bg px-1 font-medium text-diff-added-text">
                        {r.text || " "}
                      </span>
                    </p>
                  );
                })}
                <p className="pt-2 text-center italic text-on-surface-variant opacity-60">
                  End of comparison view
                </p>
              </div>
            )}

            {/* Version timeline */}
            <div className="relative space-y-stack-lg pl-1">
              <div className="absolute bottom-2 left-[13px] top-2 z-0 w-[1px] bg-outline-variant" />
              {versions.map((v, idx) => {
                const isCurrent = idx === 0;
                return (
                  <div key={v.id} className="relative z-10 flex gap-4">
                    <div
                      className={
                        isCurrent
                          ? "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-4 border-surface-container-low bg-primary"
                          : "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-4 border-surface-container-low bg-surface-container-highest"
                      }
                    >
                      {isCurrent ? (
                        <span className="material-symbols-outlined text-[14px] text-white">
                          history
                        </span>
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-outline" />
                      )}
                    </div>
                    <div
                      className={
                        isCurrent
                          ? "-mt-1 flex-1 rounded-lg border border-primary bg-surface p-3 shadow-sm"
                          : "-mt-1 flex-1 rounded-lg border border-outline-variant/60 p-3 transition-colors hover:border-outline"
                      }
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span
                          className={
                            isCurrent
                              ? "text-[12px] font-label-md text-primary"
                              : "text-[12px] font-label-md text-on-surface-variant"
                          }
                        >
                          {isCurrent ? "Current Version" : new Date(v.createdAt).toLocaleDateString()}
                        </span>
                        <span
                          className={
                            v.auto
                              ? "rounded px-1.5 py-0.5 font-label-sm text-[10px] bg-secondary-container text-on-secondary-container"
                              : "rounded px-1.5 py-0.5 font-label-sm text-[10px] bg-surface-container-highest text-on-surface-variant"
                          }
                        >
                          {v.auto ? "AUTO" : "MANUAL"}
                        </span>
                      </div>
                      <h4 className="mb-1 font-body-md font-semibold text-primary">{v.name}</h4>
                      <div className="mb-3 flex items-center gap-2">
                        <div
                          className={
                            isCurrent
                              ? "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-fixed"
                              : "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-surface-container-highest"
                          }
                        >
                          <span
                            className={
                              isCurrent
                                ? "text-[9px] font-label-sm text-primary"
                                : "text-[9px] font-label-sm text-on-surface-variant"
                            }
                          >
                            {v.createdByName ? initials(v.createdByName) : "—"}
                          </span>
                        </div>
                        <span className="font-label-sm text-on-surface-variant">
                          {v.createdByName ?? "System"} • {new Date(v.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      {!isCurrent && (
                        <button
                          className="w-full rounded border border-primary py-1.5 font-label-sm text-[11px] text-primary transition-all hover:bg-primary hover:text-on-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!canManage || busy}
                          onClick={() => void rollback(v.id)}
                        >
                          Restore this version
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer: manual snapshot */}
      <div className="sticky bottom-0 border-t border-outline-variant bg-surface-container p-stack-md">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-label-md text-label-md text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canManage || busy}
          onClick={() => void save()}
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Save version
        </button>
        <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-on-surface-variant opacity-60">
          All changes are digitally signed
        </p>
      </div>
    </div>
  );
}
