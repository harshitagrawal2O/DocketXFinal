import { useEffect, useMemo, useState } from "react";
import type { TemplateCategory, TemplateSummary } from "@docket/shared";
import { templatesApi } from "@/lib/api";

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  agreement: "Agreements",
  corporate: "Corporate",
  employment: "Employment",
  litigation: "Litigation",
  property: "Property",
  "tax-ca": "Tax & CA",
  notice: "Notices",
  other: "Other",
};

type SourceFilter = "mine" | "presets" | "all";
type SortKey = "title" | "category" | "fields";

const SORT_LABEL: Record<SortKey, string> = {
  title: "Title (A–Z)",
  category: "Category",
  fields: "Most fields",
};

/** A template is a "preset" when it is a builtin (read-only) template. */
function isPreset(t: TemplateSummary): boolean {
  return t.source === "builtin";
}

interface Props {
  onOpenTemplate: (id: string) => void;
  onCreate: () => void;
  onUpload: () => void;
  /** Open the chat-first "Draft with Viki" intake flow. */
  onDraftWithViki: () => void;
  /** Bumped after a create/upload/draft/delete succeeds so the gallery re-fetches. */
  reloadKey: number;
}

export function TemplateGallery({
  onOpenTemplate,
  onCreate,
  onUpload,
  onDraftWithViki,
  reloadKey,
}: Props) {
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [sort, setSort] = useState<SortKey>("title");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    setTemplates(null);
    setError(null);
    templatesApi
      .list()
      .then((t) => alive && setTemplates(t))
      .catch(() => alive && setError("Could not load templates."));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const categoriesPresent = useMemo(() => {
    const set = new Set<TemplateCategory>();
    for (const t of templates ?? []) set.add(t.category);
    return (Object.keys(CATEGORY_LABEL) as TemplateCategory[]).filter((c) => set.has(c));
  }, [templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = (templates ?? []).filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (source === "presets" && !isPreset(t)) return false;
      if (source === "mine" && isPreset(t)) return false;
      if (q && !(`${t.title} ${t.description}`.toLowerCase().includes(q))) return false;
      return true;
    });
    const sorted = [...rows].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "fields") return b.variableCount - a.variableCount;
      return (
        CATEGORY_LABEL[a.category].localeCompare(CATEGORY_LABEL[b.category]) ||
        a.title.localeCompare(b.title)
      );
    });
    return sorted;
  }, [templates, category, source, sort, search]);

  const presets = filtered.filter(isPreset);
  const mine = filtered.filter((t) => !isPreset(t));

  return (
    <div className="max-w-container-max-width mx-auto px-margin-page py-stack-lg">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md mb-stack-lg border-b border-outline-variant pb-stack-md">
        <div>
          <h1 className="font-headline-display text-headline-display text-primary italic mb-2">
            Templates
          </h1>
          <p className="text-on-surface-variant font-body-md max-w-xl">
            Start a case-specific document from a reusable, fillable skeleton.
          </p>
        </div>
        <div className="flex items-center gap-stack-sm shrink-0">
          <button
            onClick={onUpload}
            className="px-gutter py-2.5 border border-outline-variant text-on-surface-variant rounded-lg font-label-md text-label-md hover:bg-surface-container-high transition-all"
          >
            Upload / draft
          </button>
          <button
            onClick={onCreate}
            className="bg-secondary text-white hover:bg-[#5b421c] hover:-translate-y-0.5 px-stack-lg py-3 rounded-full flex items-center gap-2 font-label-md text-label-md transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              add
            </span>
            New Template
          </button>
        </div>
      </header>

      {/* Draft with Viki promo banner */}
      <button
        onClick={onDraftWithViki}
        className="w-full text-left rounded-xl p-stack-lg mb-stack-lg flex flex-col md:flex-row items-center justify-between gap-stack-md text-on-primary bg-gradient-to-br from-primary to-primary-container relative overflow-hidden hover:opacity-95 transition-opacity"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-secondary-fixed" aria-hidden="true">
              auto_awesome
            </span>
            <h3 className="font-headline-md text-headline-md italic">Draft with Viki</h3>
          </div>
          <p className="text-on-primary-container max-w-lg font-body-md">
            Describe your requirements and let Viki generate a custom legal template based on
            your firm's historical filings and latest judicial precedents.
          </p>
        </div>
        <span className="relative z-10 shrink-0 px-8 py-3 bg-on-primary text-primary font-label-md text-label-md rounded-full shadow-lg uppercase tracking-wide">
          Start generating
        </span>
      </button>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-stack-md mb-stack-lg">
        <div className="relative min-w-[180px]">
          <select
            className="w-full appearance-none pl-4 pr-9 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-label-md font-label-md text-on-surface cursor-pointer"
            value={category}
            onChange={(e) => setCategory(e.target.value as TemplateCategory | "all")}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categoriesPresent.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <span
            className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-lg"
            aria-hidden="true"
          >
            expand_more
          </span>
        </div>

        <div className="flex bg-surface-container-high p-1 rounded-full border border-outline-variant" role="tablist" aria-label="Source">
          {(["mine", "presets", "all"] as SourceFilter[]).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={source === s}
              className={`px-4 py-1.5 rounded-full text-label-sm font-label-md transition-all ${
                source === s
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-highest"
              }`}
              onClick={() => setSource(s)}
            >
              {s === "mine" ? "Mine" : s === "presets" ? "Presets" : "All"}
            </button>
          ))}
        </div>

        <div className="relative min-w-[160px]">
          <select
            className="w-full appearance-none pl-4 pr-9 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-label-md font-label-md text-on-surface cursor-pointer"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort templates"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
          <span
            className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-lg"
            aria-hidden="true"
          >
            expand_more
          </span>
        </div>

        <div className="flex-1 min-w-[220px] relative">
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg"
            aria-hidden="true"
          >
            search
          </span>
          <input
            className="w-full pl-10 pr-4 py-2 bg-transparent border-b border-outline-variant focus:border-primary focus:outline-none transition-colors placeholder:text-outline font-body-md text-on-surface"
            type="search"
            placeholder="Search by statute, clause, or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search templates"
          />
        </div>
      </div>

      {templates === null && !error && (
        <div className="text-on-surface-variant font-body-md italic py-stack-lg">
          Loading the template library…
        </div>
      )}
      {error && (
        <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 font-body-md mb-stack-md">
          {error}
        </div>
      )}
      {templates && filtered.length === 0 && !error && (
        <div className="text-center py-stack-lg border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-low">
          <p className="font-headline-md text-headline-md text-primary mb-2">No templates match</p>
          <p className="text-on-surface-variant font-body-md">
            Try a different filter, or create a template from scratch or one of your firm's
            documents.
          </p>
        </div>
      )}

      <div className="space-y-stack-lg">
        {presets.length > 0 && (
          <section>
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2 mb-stack-md">
              <h2 className="font-label-md text-label-md tracking-widest text-outline uppercase">
                System Presets
              </h2>
              <span className="text-label-sm text-outline">
                {presets.length} TEMPLATE{presets.length === 1 ? "" : "S"}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
              {presets.map((t) => (
                <TemplateCard key={t.id} t={t} onOpen={onOpenTemplate} />
              ))}
            </div>
          </section>
        )}

        {mine.length > 0 && (
          <section>
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2 mb-stack-md">
              <h2 className="font-label-md text-label-md tracking-widest text-outline uppercase">
                Your Templates
              </h2>
              <span className="text-label-sm text-outline">
                {mine.length} TEMPLATE{mine.length === 1 ? "" : "S"}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
              {mine.map((t) => (
                <TemplateCard key={t.id} t={t} onOpen={onOpenTemplate} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  t,
  onOpen,
}: {
  t: TemplateSummary;
  onOpen: (id: string) => void;
}) {
  const preset = isPreset(t);
  return (
    <button
      onClick={() => onOpen(t.id)}
      className="p-stack-md border border-outline-variant bg-white hover:bg-surface-container transition-all cursor-pointer flex flex-col h-full text-left rounded-sm"
    >
      <div className="flex justify-between items-start gap-2 mb-4">
        <span className="px-2 py-1 bg-surface-container-high rounded text-[10px] font-label-md text-secondary uppercase tracking-tighter">
          {CATEGORY_LABEL[t.category]}
        </span>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-label-md uppercase tracking-tight ${
            preset
              ? "bg-secondary-container text-on-secondary-container"
              : "bg-surface-container-highest text-on-surface-variant"
          }`}
        >
          {preset ? "⭐ Preset" : "Custom"}
        </span>
      </div>
      <h3 className="font-headline-md text-headline-md text-primary mb-2">{t.title}</h3>
      <p className="text-on-surface-variant text-label-md font-body-md flex-1 line-clamp-2">
        {t.description}
      </p>
      <div className="mt-stack-md pt-stack-md border-t border-outline-variant/30 flex justify-between items-center text-outline">
        <span className="text-[11px] font-label-md uppercase tracking-wide">
          {t.variableCount} field{t.variableCount === 1 ? "" : "s"}
        </span>
        <span className="material-symbols-outlined text-sm" aria-hidden="true">
          {preset ? "open_in_new" : "edit"}
        </span>
      </div>
    </button>
  );
}
