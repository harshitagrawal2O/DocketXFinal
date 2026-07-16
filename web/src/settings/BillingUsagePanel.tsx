/**
 * Billing & Usage — matches the usage_billing_dashboard mockup, but honest
 * about what we actually have: per docs/API_CONTRACT.md, GET
 * /api/usage/summary is scoped to the CALLER's own usage only (there is no
 * firm/org model yet), and there is no monetary spend/plan/seats data at
 * all. Every number rendered here comes straight from UsageSummary — no
 * fabricated currency figures, plan names, or seat counts.
 */
import { useEffect, useState } from "react";
import type { UsageByKind, UsageDayPoint, UsageSummary } from "@docket/shared";
import { ApiError, usageApi } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/shell/States";

interface LoadError {
  message: string;
  code?: string;
}

export function BillingUsagePanel() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    usageApi
      .summary(30)
      .then((s) => {
        if (alive) setSummary(s);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoadError({
          message: "Could not load your usage summary.",
          code: e instanceof ApiError ? `HTTP ${e.status}` : undefined,
        });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  return (
    <div className="max-w-4xl mx-auto py-stack-lg px-margin-page">
      <div className="mb-stack-lg">
        <h1 className="font-headline-lg text-headline-lg text-primary mb-unit">
          Billing &amp; Usage
        </h1>
        <p className="font-body-md text-on-surface-variant">
          Your Viki AI and document activity over the last {summary?.rangeDays ?? 30} days.
        </p>
      </div>

      {loading && (
        <div className="bg-surface rounded-lg border border-outline-variant/50">
          <LoadingState label="Loading usage summary…" />
        </div>
      )}

      {!loading && loadError && (
        <div className="bg-surface rounded-lg border border-outline-variant/50">
          <ErrorState
            title="Couldn't load usage data"
            body={`${loadError.message} Your documents are unaffected — this only affects the billing view.`}
            errorCode={loadError.code}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        </div>
      )}

      {!loading && !loadError && summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter mb-stack-md">
            <StatTile label="Documents Created" value={summary.documentsCreated} />
            <StatTile label="Agent Runs" value={summary.agentRuns} />
            <StatTile label="Total Calls" value={summary.totals.calls} />
            <StatTile
              label="Total Tokens"
              value={summary.totals.inputTokens + summary.totals.outputTokens}
            />
          </div>

          <p className="text-label-sm text-on-surface-variant italic mb-stack-lg">
            Usage shown is scoped to your account. Firm-wide billing requires an organization
            plan (coming soon).
          </p>

          <div className="bg-surface rounded-lg border border-outline-variant/50 p-stack-lg mb-stack-lg">
            <h2 className="font-headline-md text-headline-md text-primary mb-stack-md">
              Usage by Kind
            </h2>
            {summary.byKind.length === 0 ? (
              <EmptyState
                icon="bar_chart"
                heading="No usage recorded yet"
                body="Once you start drafting or running Viki AI, a breakdown by call type will appear here."
              />
            ) : (
              <BreakdownBars rows={summary.byKind} />
            )}
          </div>

          <div className="bg-surface rounded-lg border border-outline-variant/50 overflow-hidden">
            <div className="px-stack-lg py-stack-md border-b border-outline-variant">
              <h2 className="font-headline-md text-headline-md text-primary">Daily Activity</h2>
            </div>
            {summary.byDay.length === 0 ? (
              <div className="p-stack-lg">
                <EmptyState
                  icon="calendar_today"
                  heading="No activity in this range"
                  body="Daily call and token counts will show up here once you start using Docket."
                />
              </div>
            ) : (
              <DayTable rows={summary.byDay} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface border border-outline-variant rounded-lg p-stack-md">
      <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-stack-sm">
        {label}
      </p>
      <p className="font-headline-lg text-headline-lg text-primary">{value.toLocaleString()}</p>
    </div>
  );
}

function BreakdownBars({ rows }: { rows: UsageByKind[] }) {
  const max = Math.max(...rows.map((r) => r.calls), 1);
  return (
    <div className="space-y-stack-md">
      {rows.map((row) => (
        <div key={row.kind}>
          <div className="flex justify-between items-baseline mb-stack-sm gap-stack-md">
            <span className="font-label-md text-label-md text-primary capitalize">
              {row.kind.replace(/[_-]/g, " ")}
            </span>
            <span className="font-body-md text-body-md text-on-surface-variant text-right whitespace-nowrap">
              {row.calls.toLocaleString()} calls ·{" "}
              {(row.inputTokens + row.outputTokens).toLocaleString()} tokens
            </span>
          </div>
          <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-container transition-[width] duration-500"
              style={{ width: `${Math.max((row.calls / max) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DayTable({ rows }: { rows: UsageDayPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-container-low">
            <th className="px-stack-lg py-stack-sm font-label-md text-label-md text-secondary uppercase tracking-wider">
              Date
            </th>
            <th className="px-stack-lg py-stack-sm font-label-md text-label-md text-secondary uppercase tracking-wider text-right">
              Calls
            </th>
            <th className="px-stack-lg py-stack-sm font-label-md text-label-md text-secondary uppercase tracking-wider text-right">
              Input Tokens
            </th>
            <th className="px-stack-lg py-stack-sm font-label-md text-label-md text-secondary uppercase tracking-wider text-right">
              Output Tokens
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {rows.map((row, i) => (
            <tr key={row.date} className={i % 2 === 1 ? "bg-[#FAF8F5]" : undefined}>
              <td className="px-stack-lg py-stack-sm font-body-md text-body-md text-primary font-mono">
                {row.date}
              </td>
              <td className="px-stack-lg py-stack-sm font-body-md text-body-md text-primary text-right">
                {row.calls.toLocaleString()}
              </td>
              <td className="px-stack-lg py-stack-sm font-body-md text-body-md text-on-surface-variant text-right">
                {row.inputTokens.toLocaleString()}
              </td>
              <td className="px-stack-lg py-stack-sm font-body-md text-body-md text-on-surface-variant text-right">
                {row.outputTokens.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
