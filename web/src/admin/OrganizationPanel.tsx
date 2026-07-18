import { useEffect, useState } from "react";
import type { OrganizationDTO } from "@docket/shared";
import { adminApi, ApiError } from "@/lib/api";
import { LoadingState, ErrorState } from "@/shell/States";

export function OrganizationPanel() {
  const [org, setOrg] = useState<OrganizationDTO | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    adminApi
      .organization()
      .then((o) => {
        setOrg(o);
        setName(o.name);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load your organization."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await adminApi.updateOrganization({ name: name.trim() });
      setOrg(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading organization…" />;
  if (error && !org) return <ErrorState title="Could not load organization" body={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-2xl px-margin-page py-stack-lg">
      <div className="mb-stack-lg">
        <h1 className="mb-unit font-headline-lg text-headline-lg text-primary">Organization</h1>
        <p className="font-body-md text-on-surface-variant">
          This firm's identity on Docket. Every member you invite joins this organization.
        </p>
      </div>

      <div className="space-y-stack-md rounded border border-outline-variant/50 bg-surface p-stack-lg">
        <label className="block space-y-stack-sm">
          <span className="font-label-md text-label-md text-on-surface-variant">FIRM NAME</span>
          <input
            className="w-full border-b border-outline-variant bg-transparent py-stack-sm font-body-md text-on-surface outline-none transition-colors focus:border-primary focus:ring-0"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="text-label-sm text-on-surface-variant">
          Organization id: <span className="font-mono">{org?.id}</span> · slug: <span className="font-mono">{org?.slug}</span>
        </p>
        {error && <p className="text-body-md text-error">{error}</p>}
        <div className="flex items-center gap-stack-md">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !name.trim()}
            className="rounded bg-primary px-stack-lg py-stack-sm font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-label-sm text-success">Saved.</span>}
        </div>
      </div>
    </div>
  );
}
