import { useEffect, useState } from "react";
import type { OrganizationDTO } from "@docket/shared";
import { adminApi, ApiError } from "@/lib/api";
import { LoadingState, ErrorState } from "@/shell/States";

export function DatabasePanel() {
  const [org, setOrg] = useState<OrganizationDTO | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    adminApi
      .organization()
      .then(setOrg)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load your organization."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function save() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await adminApi.setDatabase({ databaseUrl: url.trim() });
      setOrg(updated);
      setUrl("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not switch to that database.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      setOrg(await adminApi.clearDatabase());
      setConfirmClear(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not revert the database.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading…" />;
  if (error && !org) return <ErrorState title="Could not load" body={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-2xl px-margin-page py-stack-lg">
      <div className="mb-stack-lg">
        <h1 className="mb-unit font-headline-lg text-headline-lg text-primary">Database</h1>
        <p className="font-body-md text-on-surface-variant">
          Give this organization a genuinely separate Neon Postgres database for its documents, proposals, audit
          trail, and templates — full data isolation from every other organization on the platform.
        </p>
      </div>

      <div className="space-y-stack-md rounded border border-outline-variant/50 bg-surface p-stack-lg">
        <div className="flex items-center gap-stack-sm">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
            {org?.hasOwnDatabase ? "check_circle" : "info"}
          </span>
          <p className="font-body-md text-on-surface">
            {org?.hasOwnDatabase ? (
              <>
                Using this organization's own database: <span className="font-mono">{org.databaseHint}</span>
              </>
            ) : (
              "Currently sharing the platform's default database."
            )}
          </p>
        </div>

        <label className="block space-y-stack-sm">
          <span className="font-label-md text-label-md text-on-surface-variant">
            {org?.hasOwnDatabase ? "Switch to a different Neon connection string" : "Set this organization's own Neon database"}
          </span>
          <input
            type="password"
            className="w-full rounded border border-outline-variant bg-white px-3 py-2 font-mono text-body-md focus:border-primary focus:outline-none"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require"
            autoComplete="off"
          />
        </label>
        <p className="text-label-sm text-on-surface-variant">
          Paste a connection string to a database you've already created in Neon (or any Postgres). We test the
          connection, run every migration this app needs, and seed the standard template library into it — all
          before switching anything over. This can take a few seconds.
        </p>

        {error && <p className="text-body-md text-error">{error}</p>}

        <div className="flex items-center gap-stack-md">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !url.trim()}
            className="rounded bg-primary px-stack-lg py-stack-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Setting up…" : "Connect this database"}
          </button>
          {org?.hasOwnDatabase && !confirmClear && (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={busy}
              className="rounded border border-outline-variant px-stack-lg py-stack-sm font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high"
            >
              Revert to platform default
            </button>
          )}
          {confirmClear && (
            <>
              <span className="text-label-sm text-on-surface-variant">
                This firm's documents will stop being visible until you reconnect that database. Sure?
              </span>
              <button
                type="button"
                onClick={() => void clear()}
                disabled={busy}
                className="rounded border border-error/30 px-stack-md py-stack-sm font-label-md text-label-sm text-error hover:bg-error-container"
              >
                Yes, revert
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="text-label-sm text-on-surface-variant hover:underline"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
