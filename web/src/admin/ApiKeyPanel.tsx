import { useEffect, useState } from "react";
import type { OrganizationDTO } from "@docket/shared";
import { adminApi, ApiError } from "@/lib/api";
import { LoadingState, ErrorState } from "@/shell/States";

export function ApiKeyPanel() {
  const [org, setOrg] = useState<OrganizationDTO | null>(null);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (!key.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await adminApi.setApiKey({ apiKey: key.trim() });
      setOrg(updated);
      setKey("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save that key.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      setOrg(await adminApi.clearApiKey());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not clear the key.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading…" />;
  if (error && !org) return <ErrorState title="Could not load" body={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-2xl px-margin-page py-stack-lg">
      <div className="mb-stack-lg">
        <h1 className="mb-unit font-headline-lg text-headline-lg text-primary">Anthropic API Key</h1>
        <p className="font-body-md text-on-surface-variant">
          One organization, one key: every Viki run in this firm is billed to this key. Leave it unset to use the
          platform's shared key instead.
        </p>
      </div>

      <div className="space-y-stack-md rounded border border-outline-variant/50 bg-surface p-stack-lg">
        <div className="flex items-center gap-stack-sm">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
            {org?.hasOwnApiKey ? "check_circle" : "info"}
          </span>
          <p className="font-body-md text-on-surface">
            {org?.hasOwnApiKey ? (
              <>
                Using this organization's own key: <span className="font-mono">{org.apiKeyHint}</span>
              </>
            ) : (
              "Currently using the platform's shared key."
            )}
          </p>
        </div>

        <label className="block space-y-stack-sm">
          <span className="font-label-md text-label-md text-on-surface-variant">
            {org?.hasOwnApiKey ? "Replace with a new key" : "Set this organization's key"}
          </span>
          <input
            type="password"
            className="w-full rounded border border-outline-variant bg-white px-3 py-2 font-mono text-body-md focus:border-primary focus:outline-none"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
          />
        </label>

        {error && <p className="text-body-md text-error">{error}</p>}

        <div className="flex items-center gap-stack-md">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !key.trim()}
            className="rounded bg-primary px-stack-lg py-stack-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Validating…" : "Save key"}
          </button>
          {org?.hasOwnApiKey && (
            <button
              type="button"
              onClick={() => void clear()}
              disabled={busy}
              className="rounded border border-outline-variant px-stack-lg py-stack-sm font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high"
            >
              Revert to platform key
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
