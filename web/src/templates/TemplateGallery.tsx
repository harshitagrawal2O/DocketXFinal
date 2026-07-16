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
    <div className="templates-view">
      <header className="templates-head">
        <div>
          <h2>Templates</h2>
          <p className="muted">
            Start a case-specific document from a reusable, fillable skeleton.
          </p>
        </div>
        <div className="templates-head-actions">
          <button className="btn viki-cta" onClick={onDraftWithViki}>
            ✨ Draft with Viki
          </button>
          <button className="btn btn-sm" onClick={onUpload}>
            Upload / draft
          </button>
          <button className="btn btn-primary" onClick={onCreate}>
            ＋ Create Template
          </button>
        </div>
      </header>

      <button className="viki-banner" onClick={onDraftWithViki}>
        <span className="viki-banner-icon" aria-hidden="true">
          ✨
        </span>
        <span className="viki-banner-text">
          <strong>Not sure which template?</strong>
          <span className="muted">
            Chat with Viki — describe your matter and she'll draft the whole document.
          </span>
        </span>
        <span className="viki-banner-arrow" aria-hidden="true">
          →
        </span>
      </button>

      <div className="gallery-controls">
        <select
          className="gallery-select"
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

        <div className="seg-control" role="tablist" aria-label="Source">
          {(["mine", "presets", "all"] as SourceFilter[]).map((s) => (
            <button
              key={s}
              className={source === s ? "active" : ""}
              onClick={() => setSource(s)}
            >
              {s === "mine" ? "Mine" : s === "presets" ? "Presets" : "All"}
            </button>
          ))}
        </div>

        <select
          className="gallery-select"
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

        <input
          className="gallery-search"
          type="search"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search templates"
        />
      </div>

      {templates === null && !error && (
        <div className="intent-line">Loading the template library…</div>
      )}
      {error && <div className="error-line">{error}</div>}
      {templates && filtered.length === 0 && !error && (
        <div className="empty-state">
          <p className="empty-title">No templates match</p>
          <p className="muted">
            Try a different filter, or create a template from scratch or one of your firm's
            documents.
          </p>
        </div>
      )}

      {mine.length > 0 && (
        <section className="template-group">
          <h3 className="template-group-title">
            Your Templates <span className="group-count">{mine.length}</span>
          </h3>
          <div className="template-grid">
            {mine.map((t) => (
              <TemplateCard key={t.id} t={t} onOpen={onOpenTemplate} />
            ))}
          </div>
        </section>
      )}

      {presets.length > 0 && (
        <section className="template-group">
          <h3 className="template-group-title">
            System Presets <span className="group-count">{presets.length}</span>
          </h3>
          <div className="template-grid">
            {presets.map((t) => (
              <TemplateCard key={t.id} t={t} onOpen={onOpenTemplate} />
            ))}
          </div>
        </section>
      )}
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
    <button className="template-card" onClick={() => onOpen(t.id)}>
      <div className="template-card-head">
        <span className="template-card-title">{t.title}</span>
        <span className={`tpl-badge ${preset ? "tpl-badge--builtin" : "tpl-badge--custom"}`}>
          {preset ? "⭐ Preset" : "Custom"}
        </span>
      </div>
      <div className="template-card-badges">
        <span className="tpl-chip-sm">{CATEGORY_LABEL[t.category]}</span>
        <span className="tpl-chip-sm">{t.kind}</span>
      </div>
      <p className="template-card-desc muted">{t.description}</p>
      <span className="template-card-meta muted">
        {t.variableCount} field{t.variableCount === 1 ? "" : "s"}
      </span>
    </button>
  );
}
