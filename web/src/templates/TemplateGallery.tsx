import { useEffect, useState } from "react";
import type { TemplateCategory, TemplateSource, TemplateSummary } from "@docket/shared";
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

const CATEGORY_ORDER: TemplateCategory[] = [
  "agreement",
  "corporate",
  "employment",
  "litigation",
  "property",
  "tax-ca",
  "notice",
  "other",
];

const SOURCE_LABEL: Record<TemplateSource, string> = {
  builtin: "Built-in",
  uploaded: "Uploaded",
  viki: "Viki",
};

interface Props {
  onOpenTemplate: (id: string) => void;
  onNewFromUpload: () => void;
  /** Bumped after an upload/draft succeeds so the gallery re-fetches. */
  reloadKey: number;
}

export function TemplateGallery({ onOpenTemplate, onNewFromUpload, reloadKey }: Props) {
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const grouped = new Map<TemplateCategory, TemplateSummary[]>();
  for (const t of templates ?? []) {
    const bucket = grouped.get(t.category) ?? [];
    bucket.push(t);
    grouped.set(t.category, bucket);
  }

  return (
    <div className="templates-view">
      <header className="templates-head">
        <div>
          <h2>Templates</h2>
          <p className="muted">
            Start a case-specific document from a reusable, fillable skeleton.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onNewFromUpload}>
          + Upload / draft
        </button>
      </header>

      {templates === null && !error && (
        <div className="intent-line">Loading the template library…</div>
      )}
      {error && <div className="error-line">{error}</div>}
      {templates && templates.length === 0 && (
        <div className="empty-state">
          <p className="empty-title">No templates yet</p>
          <p className="muted">
            Upload one of your firm's documents or ask Viki to draft a fresh template.
          </p>
        </div>
      )}

      {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => (
        <section key={cat} className="template-group">
          <h3 className="template-group-title">{CATEGORY_LABEL[cat]}</h3>
          <div className="template-grid">
            {grouped.get(cat)!.map((t) => (
              <button
                key={t.id}
                className="template-card"
                onClick={() => onOpenTemplate(t.id)}
              >
                <div className="template-card-head">
                  <span className="template-card-title">{t.title}</span>
                  <span className={`tpl-badge tpl-badge--${t.source}`}>
                    {SOURCE_LABEL[t.source]}
                  </span>
                </div>
                <p className="template-card-desc muted">{t.description}</p>
                <span className="template-card-meta muted">
                  {t.kind} · {t.variableCount} field{t.variableCount === 1 ? "" : "s"}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
