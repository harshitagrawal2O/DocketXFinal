/**
 * Shared "global state" primitives — the reference vocabulary from the
 * global_states_empty_loading mockup (see docs/STITCH_PATTERNS.md). Every
 * screen that can be empty, loading, or errored should reuse these instead
 * of inventing its own spinner/blank-page treatment.
 *
 * Hard product rule: never render a bare spinner with no text. LoadingState
 * enforces this by requiring a `label`.
 */

interface EmptyStateProps {
  /** Material Symbols Outlined icon name, rendered thin-weight inside a ring. */
  icon: string;
  heading: string;
  body: string;
  /** Text-link CTA (not a filled button). Rendered only when both are given. */
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon, heading, body, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-stack-md py-stack-lg">
      <div className="relative mb-stack-lg group">
        <div className="absolute -inset-4 bg-surface-container rounded-full scale-0 group-hover:scale-100 transition-transform duration-500 opacity-50" />
        <span
          className="material-symbols-outlined text-[80px] text-outline-variant transition-colors duration-300 group-hover:text-secondary-fixed-dim"
          style={{ fontVariationSettings: "'wght' 100" }}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <h3 className="font-headline-md text-headline-md text-primary mb-stack-sm">{heading}</h3>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-xs mb-stack-lg">
        {body}
      </p>
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="inline-flex items-center gap-2 text-secondary font-label-md text-label-md hover:gap-3 transition-all"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            arrow_forward
          </span>
          <span className="border-b border-secondary/30 pb-0.5 uppercase tracking-wide">
            {ctaLabel}
          </span>
        </button>
      )}
    </div>
  );
}

interface LoadingStateProps {
  /** What's happening, e.g. "Loading usage summary…". Always rendered as text. */
  label: string;
  step?: number;
  totalSteps?: number;
}

export function LoadingState({ label, step, totalSteps }: LoadingStateProps) {
  const showStep = step != null && totalSteps != null;
  return (
    <div
      className="flex flex-col items-center justify-center px-stack-md py-stack-lg"
      role="status"
      aria-live="polite"
    >
      {/* Scoped keyframes for the 1px indeterminate sliding-highlight line —
          a genuinely new animation that isn't in global.css. Kept minimal
          and local to this component rather than added globally. */}
      <style>{`
        @keyframes docket-loading-line-expand {
          0% { width: 0%; left: 0; }
          50% { width: 100%; left: 0; }
          100% { width: 0%; left: 100%; }
        }
      `}</style>
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-end mb-stack-sm gap-stack-md">
          <p className="text-[11px] font-label-sm text-outline uppercase tracking-widest">
            {label}
          </p>
          {showStep && (
            <span className="text-[11px] font-label-sm text-secondary italic whitespace-nowrap">
              Step {step} of {totalSteps}
            </span>
          )}
        </div>
        <div className="relative h-[1px] bg-outline-variant w-full overflow-hidden">
          <div
            className="absolute top-0 h-full bg-primary"
            style={{ animation: "docket-loading-line-expand 2.5s ease-in-out infinite" }}
          />
        </div>
        <div className="mt-stack-md space-y-stack-sm opacity-40 select-none" aria-hidden="true">
          <div className="h-4 bg-surface-container w-3/4 rounded-sm" />
          <div className="h-4 bg-surface-container w-full rounded-sm" />
          <div className="h-4 bg-surface-container w-1/2 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  body: string;
  /** Shown verbatim, e.g. "HTTP 503" — always a real code, never invented. */
  errorCode?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Optional ghost fallback action alongside Retry (e.g. "View offline"). */
  fallbackLabel?: string;
  onFallback?: () => void;
}

export function ErrorState({
  title,
  body,
  errorCode,
  onRetry,
  retryLabel = "Retry",
  fallbackLabel,
  onFallback,
}: ErrorStateProps) {
  return (
    <div
      className="flex flex-col md:flex-row items-center gap-stack-lg px-stack-md py-stack-lg max-w-4xl mx-auto text-center md:text-left"
      role="alert"
    >
      <div className="relative flex-shrink-0">
        <div className="w-24 h-24 rounded-full border border-error/20 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-error text-4xl"
            style={{ fontVariationSettings: "'wght' 200" }}
            aria-hidden="true"
          >
            cloud_off
          </span>
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-error-container text-on-error-container rounded-full flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            priority_high
          </span>
        </div>
      </div>
      <div className="space-y-stack-md">
        <div>
          <h3 className="font-headline-md text-headline-md text-primary mb-1">{title}</h3>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-lg">{body}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-stack-md">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="bg-primary text-on-primary px-6 py-2.5 rounded font-label-md text-label-md hover:bg-primary-container transition-colors inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                refresh
              </span>
              {retryLabel}
            </button>
          )}
          {fallbackLabel && onFallback && (
            <button
              type="button"
              onClick={onFallback}
              className="text-on-surface-variant px-6 py-2.5 rounded font-label-md text-label-md hover:bg-surface-container-high transition-colors"
            >
              {fallbackLabel}
            </button>
          )}
        </div>
        {errorCode && (
          <p className="text-[11px] font-label-sm text-outline italic">Error Code: {errorCode}</p>
        )}
      </div>
    </div>
  );
}
