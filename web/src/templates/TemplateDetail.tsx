import { useEffect, useMemo, useState } from "react";
import type {
  TemplateCategory,
  TemplateDTO,
  TemplateVariable,
  UpsertTemplateRequest,
  VariableType,
} from "@docket/shared";
import { templatesApi } from "@/lib/api";
import { highlightSource, substituteChips } from "./substitute";

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  agreement: "Agreement",
  corporate: "Corporate",
  employment: "Employment",
  litigation: "Litigation",
  property: "Property",
  "tax-ca": "Tax & CA",
  notice: "Notice",
  other: "Other",
};

const CATEGORY_OPTIONS: TemplateCategory[] = [
  "agreement",
  "corporate",
  "employment",
  "litigation",
  "property",
  "tax-ca",
  "notice",
  "other",
];

const KIND_OPTIONS: TemplateDTO["kind"][] = ["contract", "opinion", "filing", "memo"];

const VARIABLE_TYPES: VariableType[] = [
  "text",
  "longtext",
  "date",
  "number",
  "amount",
  "party",
];

/** Working copy of the editable fields of a template. */
interface Draft {
  title: string;
  category: TemplateCategory;
  kind: TemplateDTO["kind"];
  description: string;
  bodyHtml: string;
  variables: TemplateVariable[];
}

function draftFrom(tpl: TemplateDTO): Draft {
  return {
    title: tpl.title,
    category: tpl.category,
    kind: tpl.kind,
    description: tpl.description,
    bodyHtml: tpl.bodyHtml,
    variables: tpl.variables.map((v) => ({ ...v })),
  };
}

const EMPTY_DRAFT: Draft = {
  title: "",
  category: "agreement",
  kind: "contract",
  description: "",
  bodyHtml: "<p></p>",
  variables: [],
};

interface Props {
  /** Existing template to open; omit for "Create Template" (new owned). */
  templateId?: string;
  onBack: () => void;
  /** Jump to the Generate panel for this template. */
  onUse: (id: string) => void;
  /** A create/update/clone succeeded — refresh the gallery. */
  onSaved: (tpl: TemplateDTO) => void;
  /** The template was deleted — return to the gallery + refresh. */
  onDeleted: () => void;
  /** A preset was cloned into an owned copy — open it (in edit mode). */
  onCloned: (tpl: TemplateDTO) => void;
}

export function TemplateDetail({
  templateId,
  onBack,
  onUse,
  onSaved,
  onDeleted,
  onCloned,
}: Props) {
  const [tpl, setTpl] = useState<TemplateDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) {
      setTpl(null);
      setLoadError(null);
      return;
    }
    let alive = true;
    setTpl(null);
    setLoadError(null);
    templatesApi
      .get(templateId)
      .then((t) => alive && setTpl(t))
      .catch(() => alive && setLoadError("Could not load this template."));
    return () => {
      alive = false;
    };
  }, [templateId]);

  if (loadError) {
    return (
      <div className="templates-view">
        <button className="btn btn-sm" onClick={onBack}>
          ← Back to Templates
        </button>
        <div className="error-line">{loadError}</div>
      </div>
    );
  }

  // Create mode: no id, render immediately with an empty draft.
  if (!templateId) {
    return (
      <DetailEditor
        key="new"
        baseTemplate={null}
        onBack={onBack}
        onUse={onUse}
        onSaved={onSaved}
        onDeleted={onDeleted}
        onCloned={onCloned}
      />
    );
  }

  if (!tpl) {
    return (
      <div className="templates-view">
        <div className="intent-line">Loading the template…</div>
      </div>
    );
  }

  return (
    <DetailEditor
      key={tpl.id}
      baseTemplate={tpl}
      onBack={onBack}
      onUse={onUse}
      onSaved={onSaved}
      onDeleted={onDeleted}
      onCloned={onCloned}
    />
  );
}

interface EditorProps {
  /** null = create a brand-new owned template. */
  baseTemplate: TemplateDTO | null;
  onBack: () => void;
  onUse: (id: string) => void;
  onSaved: (tpl: TemplateDTO) => void;
  onDeleted: () => void;
  onCloned: (tpl: TemplateDTO) => void;
}

function DetailEditor({
  baseTemplate,
  onBack,
  onUse,
  onSaved,
  onDeleted,
  onCloned,
}: EditorProps) {
  const readOnly = baseTemplate !== null && baseTemplate.source === "builtin";
  const isNew = baseTemplate === null;

  const [draft, setDraft] = useState<Draft>(() =>
    baseTemplate ? draftFrom(baseTemplate) : { ...EMPTY_DRAFT },
  );
  const [bodyTab, setBodyTab] = useState<"preview" | "source">("preview");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "delete" | "clone">(null);
  const [error, setError] = useState<string | null>(null);

  const previewHtml = useMemo(
    () => substituteChips(draft.bodyHtml, draft.variables),
    [draft.bodyHtml, draft.variables],
  );
  const sourceHtml = useMemo(() => highlightSource(draft.bodyHtml), [draft.bodyHtml]);

  function patch(part: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...part }));
  }

  function toRequest(): UpsertTemplateRequest {
    return {
      title: draft.title.trim(),
      category: draft.category,
      kind: draft.kind,
      description: draft.description.trim(),
      bodyHtml: draft.bodyHtml,
      variables: draft.variables,
    };
  }

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(draft.bodyHtml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  async function save() {
    if (!draft.title.trim() || busy) return;
    setBusy("save");
    setError(null);
    try {
      const saved = isNew
        ? await templatesApi.create(toRequest())
        : await templatesApi.update(baseTemplate!.id, toRequest());
      onSaved(saved);
    } catch {
      setError("Could not save the template.");
      setBusy(null);
    }
  }

  async function remove() {
    if (isNew || busy) return;
    setBusy("delete");
    setError(null);
    try {
      await templatesApi.remove(baseTemplate!.id);
      onDeleted();
    } catch {
      setError("Could not delete the template.");
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  async function clone() {
    if (isNew || busy) return;
    setBusy("clone");
    setError(null);
    try {
      const copy = await templatesApi.clone(baseTemplate!.id);
      onCloned(copy);
    } catch {
      setError("Could not copy the template.");
      setBusy(null);
    }
  }

  // Variables editor helpers (owned/new only).
  function addVariable() {
    patch({
      variables: [
        ...draft.variables,
        { key: "", label: "", type: "text", required: false },
      ],
    });
  }
  function updateVariable(index: number, part: Partial<TemplateVariable>) {
    patch({
      variables: draft.variables.map((v, i) => (i === index ? { ...v, ...part } : v)),
    });
  }
  function removeVariable(index: number) {
    patch({ variables: draft.variables.filter((_, i) => i !== index) });
  }

  const heading = isNew ? "Create Template" : draft.title || "Untitled template";

  return (
    <div className="templates-view tpl-detail">
      <header className="tpl-detail-head">
        <button className="btn btn-sm" onClick={onBack}>
          ← Back to Templates
        </button>
        {readOnly && <span className="preset-pill">⭐ System Preset (Read Only)</span>}
      </header>

      <h2 className="generate-title">{heading}</h2>

      <div className="tpl-detail-fields">
        <label className="field">
          <span>Name</span>
          <input
            value={draft.title}
            disabled={readOnly}
            placeholder="e.g. Mutual NDA"
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <div className="tpl-detail-selects">
          <label className="field">
            <span>Category</span>
            <select
              value={draft.category}
              disabled={readOnly}
              onChange={(e) => patch({ category: e.target.value as TemplateCategory })}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Kind</span>
            <select
              value={draft.kind}
              disabled={readOnly}
              onChange={(e) => patch({ kind: e.target.value as TemplateDTO["kind"] })}
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Description</span>
          <textarea
            rows={2}
            value={draft.description}
            disabled={readOnly}
            placeholder="A short summary of what this template produces."
            onChange={(e) => patch({ description: e.target.value })}
          />
        </label>
      </div>

      {/* ---- Body / prompt panel ---- */}
      <div className="code-panel">
        <div className="code-panel-bar">
          <span className="code-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="code-filename">template-body</span>
          <div className="code-panel-toggle">
            <button
              className={bodyTab === "preview" ? "active" : ""}
              onClick={() => setBodyTab("preview")}
            >
              Preview
            </button>
            <button
              className={bodyTab === "source" ? "active" : ""}
              onClick={() => setBodyTab("source")}
            >
              Source
            </button>
          </div>
          <button className="btn btn-xs code-copy" onClick={copyBody}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {bodyTab === "preview" ? (
          <div
            className="code-panel-preview tpl-preview-doc"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : readOnly ? (
          <pre
            className="code-panel-source"
            dangerouslySetInnerHTML={{ __html: sourceHtml }}
          />
        ) : (
          <textarea
            className="code-panel-editor"
            rows={16}
            spellCheck={false}
            value={draft.bodyHtml}
            aria-label="Template body (HTML source with {{variables}})"
            onChange={(e) => patch({ bodyHtml: e.target.value })}
          />
        )}
        <p className="code-caption muted">
          This is what generates your document.
          {!readOnly && bodyTab === "source" && (
            <> Edit the HTML directly — use {"{{key}}"} for variables.</>
          )}
        </p>
      </div>

      {/* ---- Variables ---- */}
      <section className="tpl-vars">
        <div className="tpl-vars-head">
          <h3 className="template-group-title">Variables</h3>
          {!readOnly && (
            <button className="btn btn-xs" onClick={addVariable}>
              + Add variable
            </button>
          )}
        </div>

        {draft.variables.length === 0 && (
          <p className="muted field-hint">No variables — this template has no fill-in fields.</p>
        )}

        {readOnly ? (
          <ul className="tpl-var-list">
            {draft.variables.map((v) => (
              <li key={v.key} className="tpl-var-row-ro">
                <code>{`{{${v.key}}}`}</code>
                <span className="tpl-var-label">{v.label}</span>
                <span className="tpl-badge tpl-badge--custom">{v.type}</span>
                {v.required && <span className="tpl-req">required</span>}
              </li>
            ))}
          </ul>
        ) : (
          draft.variables.map((v, i) => (
            <div key={i} className="tpl-var-edit">
              <input
                className="tpl-var-key"
                value={v.key}
                placeholder="key"
                onChange={(e) => updateVariable(i, { key: e.target.value })}
              />
              <input
                className="tpl-var-lbl"
                value={v.label}
                placeholder="Label"
                onChange={(e) => updateVariable(i, { label: e.target.value })}
              />
              <select
                value={v.type}
                onChange={(e) => updateVariable(i, { type: e.target.value as VariableType })}
              >
                {VARIABLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={v.required}
                  onChange={(e) => updateVariable(i, { required: e.target.checked })}
                />
                <span>required</span>
              </label>
              <button
                className="btn btn-xs btn-ghost"
                onClick={() => removeVariable(i)}
                aria-label="Remove variable"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </section>

      {error && <div className="error-line">{error}</div>}

      {/* ---- Footer actions ---- */}
      <footer className="tpl-detail-actions">
        {readOnly ? (
          <>
            <button
              className="btn btn-primary"
              onClick={clone}
              disabled={busy !== null}
            >
              {busy === "clone" ? "Copying…" : "Copy as New Template"}
            </button>
            <button
              className="btn"
              onClick={() => onUse(baseTemplate!.id)}
              disabled={busy !== null}
            >
              Use this template
            </button>
            <button className="btn btn-ghost" onClick={onBack} disabled={busy !== null}>
              Back
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={busy !== null || !draft.title.trim()}
            >
              {busy === "save" ? "Saving…" : isNew ? "Create template" : "Save"}
            </button>
            {!isNew && (
              <button
                className="btn"
                onClick={() => onUse(baseTemplate!.id)}
                disabled={busy !== null}
              >
                Use this template
              </button>
            )}
            {!isNew &&
              (confirmDelete ? (
                <span className="tpl-delete-confirm">
                  <span className="muted">Delete this template?</span>
                  <button className="btn btn-reject btn-sm" onClick={remove} disabled={busy !== null}>
                    {busy === "delete" ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy !== null}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  className="btn btn-reject"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy !== null}
                >
                  Delete
                </button>
              ))}
            <button className="btn btn-ghost" onClick={onBack} disabled={busy !== null}>
              Cancel
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
