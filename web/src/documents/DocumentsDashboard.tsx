import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentSummary, Role } from "@docket/shared";
import { docsApi } from "@/lib/api";

const KIND_LABEL: Record<DocumentSummary["kind"], string> = {
  contract: "Contract",
  opinion: "Legal Opinion",
  filing: "Filing",
  memo: "Memo",
};

/**
 * Per-kind badge treatment — mirrors the mockup's mixed "highlighted vs.
 * neutral" category-tag styling (see STITCH_PATTERNS.md cross-cutting notes)
 * without inventing any per-document data.
 */
const KIND_BADGE_CLASS: Record<DocumentSummary["kind"], string> = {
  contract: "bg-secondary-fixed text-on-secondary-fixed-variant border border-secondary/20",
  opinion: "bg-surface-container-highest text-on-surface-variant border border-outline-variant/30",
  filing: "bg-tertiary-fixed text-on-tertiary-fixed-variant border border-outline-variant/30",
  memo: "bg-surface-container-highest text-on-surface-variant border border-outline-variant/30",
};

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  editor: "Editor",
  commenter: "Commenter",
  viewer: "Viewer",
};

type KindFilter = DocumentSummary["kind"] | "all";

const FILTERS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "contract", label: "Contracts" },
  { key: "opinion", label: "Opinions" },
  { key: "filing", label: "Filings" },
  { key: "memo", label: "Memos" },
];

/** Tiny local relative-time formatter — no new dependency. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  const diffWeek = Math.round(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek} week${diffWeek === 1 ? "" : "s"} ago`;
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;
  const diffYear = Math.round(diffDay / 365);
  return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
}

/** Status pill — the ONE reconciled status mapping (STITCH_PATTERNS.md, binding section). */
function StatusPill({ status }: { status: DocumentSummary["status"] }) {
  const cls =
    status === "in_review"
      ? "bg-info-container text-info"
      : "bg-secondary-container text-on-secondary-container";
  return (
    <span
      className={`rounded px-2 py-0.5 text-[11px] font-label-md uppercase tracking-tight ${cls}`}
    >
      {status === "in_review" ? "In Review" : "Draft"}
    </span>
  );
}

interface Props {
  /** Open an existing document in the workspace. */
  onOpenDocument: (id: string) => void;
  /** Create a new blank document — title/kind defaults are the caller's call. */
  onCreateBlank: () => void;
  /** Navigate to the Templates view — used for both "From template" and "Draft with Viki". */
  onOpenTemplates: () => void;
  /** Bumped by the app to force a re-fetch (e.g. after a template generates a doc). */
  reloadKey: number;
}

/**
 * The "Documents" home view — matches documents_dashboard (desktop) and
 * documents_dashboard_mobile, as one responsive component.
 */
export function DocumentsDashboard({
  onOpenDocument,
  onCreateBlank,
  onOpenTemplates,
  reloadKey,
}: Props) {
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<KindFilter>("all");
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    setDocs(null);
    setError(null);
    docsApi
      .list()
      .then((d) => alive && setDocs(d))
      .catch(() => alive && setError("Could not load your documents."));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Close the "New document" menu on outside click.
  useEffect(() => {
    if (!newMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [newMenuOpen]);

  const filtered = useMemo(() => {
    if (!docs) return [];
    return filter === "all" ? docs : docs.filter((d) => d.kind === filter);
  }, [docs, filter]);

  return (
    <main className="mx-auto max-w-container-max-width px-margin-page pb-20 pt-8">
      <header className="mb-stack-lg flex flex-col items-start justify-between gap-stack-md md:flex-row md:items-end">
        <div>
          <h1 className="font-headline-display text-headline-display text-primary">Documents</h1>
          <p className="mt-1 max-w-2xl font-body-md text-on-surface-variant">
            Manage your firm&rsquo;s artifacts, precedents, and active drafting cycles.
          </p>
        </div>

        {/* New document split button + dropdown. */}
        <div className="relative" ref={newMenuRef}>
          <div className="flex items-center gap-1 overflow-hidden rounded-lg bg-primary">
            <button
              type="button"
              className="flex items-center gap-2 border-r border-on-primary/10 px-6 py-3 font-label-md text-label-md uppercase tracking-wider text-on-primary transition-colors hover:bg-primary/90"
              onClick={onCreateBlank}
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              New document
            </button>
            <button
              type="button"
              className="px-3 py-3 text-on-primary transition-colors hover:bg-primary/90"
              onClick={() => setNewMenuOpen((v) => !v)}
              aria-label="More new document options"
              aria-haspopup="menu"
              aria-expanded={newMenuOpen}
            >
              <span className="material-symbols-outlined">keyboard_arrow_down</span>
            </button>
          </div>

          {newMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-10 mt-2 w-52 rounded-lg border border-outline-variant/30 bg-surface-container-lowest py-2 ink-shadow"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 px-4 py-2 text-left font-body-md text-on-surface transition-colors hover:bg-surface-container-low"
                onClick={() => {
                  setNewMenuOpen(false);
                  onCreateBlank();
                }}
              >
                <span className="material-symbols-outlined text-outline">description</span>
                Blank
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 px-4 py-2 text-left font-body-md text-on-surface transition-colors hover:bg-surface-container-low"
                onClick={() => {
                  setNewMenuOpen(false);
                  onOpenTemplates();
                }}
              >
                <span className="material-symbols-outlined text-outline">layers</span>
                From template
              </button>
              <div className="mx-2 my-1 border-t border-outline-variant/10" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 px-4 py-2 text-left font-body-md text-secondary transition-colors hover:bg-surface-container-low"
                onClick={() => {
                  setNewMenuOpen(false);
                  onOpenTemplates();
                }}
              >
                <span
                  className="material-symbols-outlined text-brass"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_awesome
                </span>
                Draft with Viki
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Filter chips by kind — client-side filter over the real doc list. */}
      <div className="no-scrollbar mb-stack-lg flex items-center gap-stack-sm overflow-x-auto border-b border-outline-variant/30 pb-stack-md">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={
              filter === f.key
                ? "flex-shrink-0 whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-label-sm font-semibold text-on-primary"
                : "flex-shrink-0 whitespace-nowrap rounded-full bg-surface-container px-4 py-1.5 text-label-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-stack-md rounded-lg bg-error-container px-4 py-3 font-body-md text-on-error-container">
          {error}
        </div>
      )}

      {docs === null && !error && (
        <div className="flex items-center justify-center gap-3 py-24 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <span className="font-label-md text-label-md">Loading your documents…</span>
        </div>
      )}

      {docs !== null && docs.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-6 py-24 text-center">
          <span className="material-symbols-outlined mb-stack-sm text-4xl text-outline">
            description
          </span>
          <h2 className="mb-2 font-headline-md text-headline-md text-primary">No documents yet</h2>
          <p className="mb-stack-md max-w-sm font-body-md text-on-surface-variant">
            Create your first document to start drafting, reviewing, and finalising with your
            team and Viki.
          </p>
          <button
            type="button"
            className="rounded-lg bg-primary px-6 py-3 font-label-md text-label-md uppercase tracking-wider text-on-primary transition-colors hover:bg-primary/90"
            onClick={onCreateBlank}
          >
            Create your first document
          </button>
        </div>
      )}

      {docs !== null &&
        docs.length > 0 &&
        (filtered.length === 0 ? (
          <p className="py-16 text-center font-body-md text-on-surface-variant">
            No documents match this filter.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((d) => (
              <div
                key={d.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenDocument(d.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenDocument(d.id);
                  }
                }}
                className="group flex cursor-pointer flex-col justify-between rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-stack-md ink-shadow transition-all hover:border-secondary"
              >
                <div>
                  <div className="mb-stack-sm flex items-start justify-between">
                    <span
                      className={`rounded px-2 py-0.5 text-label-sm font-label-md ${KIND_BADGE_CLASS[d.kind]}`}
                    >
                      {KIND_LABEL[d.kind]}
                    </span>
                    <button
                      type="button"
                      aria-label="More options"
                      className="text-outline transition-colors hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                  </div>
                  <h3 className="mb-2 line-clamp-2 font-headline-md text-headline-md leading-tight text-primary transition-colors group-hover:text-secondary">
                    {d.title}
                  </h3>
                </div>

                <div className="mt-stack-lg">
                  <div className="mb-4 flex items-center justify-between">
                    <StatusPill status={d.status} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      {ROLE_LABEL[d.myRole]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-outline-variant/10 pt-4">
                    <span className="text-label-sm text-outline">
                      Edited {timeAgo(d.updatedAt)}
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-outline opacity-0 transition-opacity group-hover:opacity-100">
                      arrow_forward
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
    </main>
  );
}
