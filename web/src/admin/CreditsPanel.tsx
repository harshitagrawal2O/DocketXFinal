import { useEffect, useState } from "react";
import type { AdminUsageSummary } from "@docket/shared";
import { adminApi, ApiError } from "@/lib/api";
import { LoadingState, ErrorState, EmptyState } from "@/shell/States";

export function CreditsPanel() {
  const [summary, setSummary] = useState<AdminUsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState("100");
  const [busy, setBusy] = useState(false);

  function load() {
    setError(null);
    adminApi
      .usage()
      .then(setSummary)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load usage."));
  }

  useEffect(load, []);

  async function addCredits() {
    const credits = Number(addAmount);
    if (!Number.isFinite(credits) || credits <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const org = await adminApi.addCredits({ credits });
      setSummary((prev) => (prev ? { ...prev, credits: org.credits, creditBalanceTokens: org.creditBalanceTokens } : prev));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add credits.");
    } finally {
      setBusy(false);
    }
  }

  if (!summary) {
    if (error) return <ErrorState title="Could not load usage" body={error} onRetry={load} />;
    return <LoadingState label="Loading credits & usage…" />;
  }

  const lowBalance = summary.credits <= 0;

  return (
    <div className="mx-auto max-w-3xl space-y-stack-lg px-margin-page py-stack-lg">
      <div>
        <h1 className="mb-unit font-headline-lg text-headline-lg text-primary">Credits &amp; Usage</h1>
        <p className="font-body-md text-on-surface-variant">
          1 credit = 1,000 Claude tokens (input + output combined). Viki runs are blocked once the balance reaches
          zero, until an admin tops it up here.
        </p>
      </div>

      <section
        className={`rounded border p-stack-lg ${lowBalance ? "border-error/30 bg-error-container/10" : "border-outline-variant/50 bg-surface"}`}
      >
        <div className="flex flex-wrap items-end justify-between gap-stack-md">
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Balance</p>
            <p className={`font-headline-lg text-headline-lg ${lowBalance ? "text-error" : "text-primary"}`}>
              {summary.credits.toLocaleString()} credits
            </p>
            {lowBalance && <p className="mt-unit text-label-sm text-error">Viki runs are currently blocked. Add credits below.</p>}
          </div>
          <div className="flex items-end gap-stack-sm">
            <label className="space-y-stack-sm">
              <span className="font-label-md text-label-sm text-on-surface-variant">Add credits</span>
              <input
                type="number"
                min={1}
                className="w-32 rounded border border-outline-variant bg-white px-3 py-2 text-body-md focus:border-primary focus:outline-none"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => void addCredits()}
              disabled={busy}
              className="rounded bg-primary px-stack-lg py-2 font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
        {error && <p className="mt-stack-md text-body-md text-error">{error}</p>}
      </section>

      <section className="space-y-stack-md rounded border border-outline-variant/50 bg-surface p-stack-lg">
        <h2 className="font-label-md text-label-md uppercase tracking-widest text-secondary">
          Usage by member (last {summary.rangeDays} days)
        </h2>
        {summary.byUser.length === 0 ? (
          <EmptyState icon="toll" heading="No usage yet" body="Run Viki on a document to see usage appear here." />
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant">
                <th className="py-2 font-label-md">Member</th>
                <th className="py-2 font-label-md">Calls</th>
                <th className="py-2 font-label-md">Input tokens</th>
                <th className="py-2 font-label-md">Output tokens</th>
              </tr>
            </thead>
            <tbody>
              {summary.byUser.map((u) => (
                <tr key={u.userId} className="border-b border-outline-variant/50 text-body-md">
                  <td className="py-2">{u.userName}</td>
                  <td className="py-2">{u.calls}</td>
                  <td className="py-2">{u.inputTokens.toLocaleString()}</td>
                  <td className="py-2">{u.outputTokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
