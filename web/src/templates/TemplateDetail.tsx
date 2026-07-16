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
      <div className="max-w-4xl mx-auto px-gutter py-stack-lg">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors mb-stack-md"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span className="font-label-md text-label-md">Back to Templates</span>
        </button>
        <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 font-body-md">
          {loadError}
        </div>
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
      <div className="max-w-4xl mx-auto px-gutter py-stack-lg">
        <div className="text-on-surface-variant font-body-md italic py-stack-lg">
          Loading the template…
        </div>
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
    () => substituteChips(draft.bodyHtml, draft.variables, readOnly ? "solid" : "dashed"),
    [draft.bodyHtml, draft.variables, readOnly],
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
    <div className="max-w-4xl mx-auto px-gutter py-stack-lg">
      {readOnly ? (
        <ReadOnlyHeader draft={draft} bodyTab={bodyTab} setBodyTab={setBodyTab} onBack={onBack} />
      ) : (
        <EditableHeader heading={heading} isNew={isNew} onBack={onBack} />
      )}

      {!readOnly && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-stack-lg bg-white p-stack-lg border border-outline-variant rounded-lg mb-stack-lg">
          <div className="space-y-stack-md">
            <label className="block">
              <span className="block font-label-md text-label-md text-outline uppercase mb-1">
                Template Name
              </span>
              <input
                className="w-full border-0 border-b border-outline-variant bg-transparent px-0 py-2 focus:ring-0 focus:border-primary focus:outline-none text-body-lg font-body-lg"
                value={draft.title}
                placeholder="e.g. Mutual NDA"
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-stack-md">
              <label className="block">
                <span className="block font-label-md text-label-md text-outline uppercase mb-1">
                  Category
                </span>
                <select
                  className="w-full border-0 border-b border-outline-variant bg-transparent px-0 py-2 focus:ring-0 focus:border-primary focus:outline-none text-body-md font-body-md appearance-none"
                  value={draft.category}
                  onChange={(e) => patch({ category: e.target.value as TemplateCategory })}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block font-label-md text-label-md text-outline uppercase mb-1">
                  Kind
                </span>
                <select
                  className="w-full border-0 border-b border-outline-variant bg-transparent px-0 py-2 focus:ring-0 focus:border-primary focus:outline-none text-body-md font-body-md appearance-none"
                  value={draft.kind}
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
          </div>
          <label className="block">
            <span className="block font-label-md text-label-md text-outline uppercase mb-1">
              Description
            </span>
            <textarea
              className="w-full border-0 border-b border-outline-variant bg-transparent px-0 py-2 focus:ring-0 focus:border-primary focus:outline-none text-body-md font-body-md resize-none"
              rows={4}
              value={draft.description}
              placeholder="A short summary of what this template produces."
              onChange={(e) => patch({ description: e.target.value })}
            />
          </label>
        </section>
      )}

      {readOnly ? (
        <>
          <section className="border border-outline-variant rounded-xl p-12 mb-stack-lg relative overflow-hidden bg-gradient-to-b from-white to-[#faf8f5] shadow-[0_4px_20px_rgba(28,37,48,0.04)]">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none select-none">
              <span className="font-headline-display text-headline-display italic">
                Docket Official
              </span>
            </div>
            <div className="relative z-10">
              {bodyTab === "preview" ? (
                <div
                  className="tpl-preview-doc font-serif text-body-lg leading-[1.8] text-on-surface"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <pre
                  className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-on-surface-variant"
                  dangerouslySetInnerHTML={{ __html: sourceHtml }}
                />
              )}
            </div>
          </section>

          <VariablesTable variables={draft.variables} />
        </>
      ) : (
        <div className="flex flex-col lg:flex-row gap-stack-lg mb-stack-lg">
          <section className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-stack-sm">
              <div className="flex bg-surface-container-low p-1 rounded-lg border border-outline-variant">
                <button
                  className={
                    bodyTab === "preview"
                      ? "px-4 py-1.5 font-label-sm text-label-sm rounded-md bg-white shadow-sm text-primary transition-all"
                      : "px-4 py-1.5 font-label-sm text-label-sm rounded-md text-on-surface-variant hover:text-primary transition-all"
                  }
                  onClick={() => setBodyTab("preview")}
                >
                  Preview
                </button>
                <button
                  className={
                    bodyTab === "source"
                      ? "px-4 py-1.5 font-label-sm text-label-sm rounded-md bg-white shadow-sm text-primary transition-all"
                      : "px-4 py-1.5 font-label-sm text-label-sm rounded-md text-on-surface-variant hover:text-primary transition-all"
                  }
                  onClick={() => setBodyTab("source")}
                >
                  Source
                </button>
              </div>
              <button
                className="text-secondary hover:underline font-label-sm text-label-sm flex items-center gap-1"
                onClick={copyBody}
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {bodyTab === "preview" ? (
              <div
                className="tpl-preview-doc bg-surface-container-lowest border border-outline-variant rounded-sm p-12 font-serif text-body-lg text-on-surface leading-[1.8] shadow-[0_10px_30px_-15px_rgba(28,37,48,0.08)] min-h-[400px]"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <textarea
                className="w-full min-h-[400px] border border-outline-variant rounded-sm p-4 font-mono text-[13px] bg-white text-on-surface focus:outline-none focus:border-secondary resize-y"
                rows={16}
                spellCheck={false}
                value={draft.bodyHtml}
                aria-label="Template body (HTML source with {{variables}})"
                onChange={(e) => patch({ bodyHtml: e.target.value })}
              />
            )}
            <p className="text-on-surface-variant text-label-sm font-label-sm italic mt-2">
              This is what generates your document.
              {bodyTab === "source" && <> Edit the HTML directly — use {"{{key}}"} for variables.</>}
            </p>
          </section>

          <aside className="w-full lg:w-80 shrink-0">
            <div className="bg-white p-stack-md border border-outline-variant rounded-sm lg:sticky lg:top-4">
              <div className="flex justify-between items-center mb-stack-md">
                <h3 className="font-label-md text-label-md text-outline uppercase">
                  Active Variables
                </h3>
                <button
                  className="text-secondary hover:underline font-label-sm text-label-sm flex items-center gap-1"
                  onClick={addVariable}
                >
                  <span className="material-symbols-outlined text-[16px]">add</span> Add
                </button>
              </div>

              {draft.variables.length === 0 && (
                <p className="text-on-surface-variant text-[12px] italic mb-stack-md">
                  No variables yet — add one, or type <code className="font-mono">{"{{key}}"}</code> in
                  the document.
                </p>
              )}

              <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3">
                {draft.variables.map((v, i) => (
                  <div key={i} className="group border-b border-surface-container-high pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <input
                        className="text-[12px] font-mono bg-surface-container-highest px-1 rounded text-primary min-w-0 flex-1 border-0 focus:outline-none focus:ring-1 focus:ring-secondary"
                        value={v.key}
                        placeholder="key"
                        onChange={(e) => updateVariable(i, { key: e.target.value })}
                      />
                      <button
                        className="opacity-0 group-hover:opacity-100 material-symbols-outlined text-error text-[18px] shrink-0 transition-opacity"
                        onClick={() => removeVariable(i)}
                        aria-label="Remove variable"
                      >
                        delete
                      </button>
                    </div>
                    <input
                      className="w-full border-0 p-0 mt-1 text-[13px] bg-transparent text-on-surface-variant focus:ring-0 focus:outline-none"
                      value={v.label}
                      placeholder="Label"
                      onChange={(e) => updateVariable(i, { label: e.target.value })}
                    />
                    <div className="flex items-center gap-3 mt-1.5">
                      <select
                        className="text-[11px] border border-outline-variant rounded px-1 py-0.5 bg-surface-container-low"
                        value={v.type}
                        onChange={(e) =>
                          updateVariable(i, { type: e.target.value as VariableType })
                        }
                      >
                        {VARIABLE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                        <input
                          type="checkbox"
                          checked={v.required}
                          onChange={(e) => updateVariable(i, { required: e.target.checked })}
                        />
                        required
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-stack-lg pt-stack-md border-t border-outline-variant">
                <div className="p-stack-sm bg-surface-container-low rounded-lg text-on-surface-variant text-[12px] italic">
                  Tip: Type double curly braces{" "}
                  <span className="font-bold font-mono not-italic">{"{{ }}"}</span> anywhere in the
                  document to create a new interactive variable.
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {error && (
        <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 font-body-md mb-stack-md">
          {error}
        </div>
      )}

      {/* ---- Footer actions ---- */}
      {readOnly ? (
        <footer className="border-t border-outline-variant pt-stack-md flex flex-wrap justify-between items-center gap-stack-md">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">info</span>
            <span className="font-label-sm text-label-sm">
              {draft.variables.length} variable{draft.variables.length === 1 ? "" : "s"} · Read-only
              system preset
            </span>
          </div>
          <div className="flex gap-stack-md">
            <button
              className="px-6 py-2.5 text-on-surface-variant font-label-md text-label-md hover:text-primary transition-all disabled:opacity-40"
              onClick={onBack}
              disabled={busy !== null}
            >
              Back
            </button>
            <button
              className="flex items-center gap-2 px-6 py-2.5 border border-secondary text-secondary rounded-lg font-label-md text-label-md hover:bg-secondary-container transition-all active:scale-95 disabled:opacity-50"
              onClick={clone}
              disabled={busy !== null}
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              {busy === "clone" ? "Copying…" : "Copy as New Template"}
            </button>
            <button
              className="flex items-center gap-2 px-8 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50"
              onClick={() => onUse(baseTemplate!.id)}
              disabled={busy !== null}
            >
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              Use this template
            </button>
          </div>
        </footer>
      ) : (
        <footer className="border-t border-outline-variant pt-stack-md flex flex-wrap justify-between items-center gap-stack-md">
          <div>
            {!isNew &&
              (confirmDelete ? (
                <span className="flex items-center gap-stack-sm">
                  <span className="text-on-surface-variant font-body-md text-sm">
                    Delete this template?
                  </span>
                  <button
                    className="text-error font-label-md text-label-sm hover:underline disabled:opacity-50"
                    onClick={remove}
                    disabled={busy !== null}
                  >
                    {busy === "delete" ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button
                    className="text-on-surface-variant font-label-md text-label-sm hover:underline"
                    onClick={() => setConfirmDelete(false)}
                    disabled={busy !== null}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  className="text-error font-label-md text-label-md hover:underline flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity disabled:opacity-40"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy !== null}
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span> Delete
                  Template
                </button>
              ))}
          </div>
          <div className="flex gap-stack-md items-center">
            <button
              className="px-6 py-2.5 text-on-surface-variant font-label-md text-label-md hover:text-primary transition-all disabled:opacity-40"
              onClick={onBack}
              disabled={busy !== null}
            >
              Cancel
            </button>
            {!isNew && (
              <button
                className="px-6 py-2.5 border border-outline text-on-surface-variant rounded font-label-md text-label-md hover:bg-surface-container-high transition-all disabled:opacity-40"
                onClick={() => onUse(baseTemplate!.id)}
                disabled={busy !== null}
              >
                Use this template
              </button>
            )}
            <button
              className="px-8 py-2.5 bg-primary text-white rounded font-label-md text-label-md uppercase tracking-wider hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
              onClick={save}
              disabled={busy !== null || !draft.title.trim()}
            >
              {busy === "save" ? "Saving…" : isNew ? "Create Template" : "Save and Finalize"}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function ReadOnlyHeader({
  draft,
  bodyTab,
  setBodyTab,
  onBack,
}: {
  draft: Draft;
  bodyTab: "preview" | "source";
  setBodyTab: (t: "preview" | "source") => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-stack-sm mb-10">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors w-fit"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        <span className="font-label-md text-label-md">Back to Templates</span>
      </button>
      <div className="flex flex-wrap items-center justify-between gap-stack-md mt-2">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="font-headline-lg text-headline-lg text-primary">{draft.title}</h1>
          <span className="flex items-center gap-1 bg-secondary-container text-secondary px-3 py-0.5 rounded-full font-label-sm text-label-sm border border-secondary/20">
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              star
            </span>
            System Preset (Read Only)
          </span>
        </div>
        <div className="flex bg-surface-container-low p-1 rounded-lg border border-outline-variant shadow-sm">
          <button
            className={
              bodyTab === "preview"
                ? "px-4 py-1.5 font-label-sm text-label-sm rounded-md bg-white shadow-sm text-primary transition-all"
                : "px-4 py-1.5 font-label-sm text-label-sm rounded-md text-on-surface-variant hover:text-primary transition-all"
            }
            onClick={() => setBodyTab("preview")}
          >
            Preview
          </button>
          <button
            className={
              bodyTab === "source"
                ? "px-4 py-1.5 font-label-sm text-label-sm rounded-md bg-white shadow-sm text-primary transition-all"
                : "px-4 py-1.5 font-label-sm text-label-sm rounded-md text-on-surface-variant hover:text-primary transition-all"
            }
            onClick={() => setBodyTab("source")}
          >
            Source
          </button>
        </div>
      </div>
      {draft.description && (
        <p className="text-on-surface-variant font-body-md max-w-2xl">{draft.description}</p>
      )}
      <div className="flex items-center gap-2 text-[11px] text-outline uppercase tracking-widest">
        <span>{CATEGORY_LABEL[draft.category]}</span>
        <span aria-hidden="true">•</span>
        <span>{draft.kind}</span>
      </div>
    </div>
  );
}

function EditableHeader({
  heading,
  isNew,
  onBack,
}: {
  heading: string;
  isNew: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex justify-between items-end border-b border-outline-variant pb-stack-md mb-stack-lg">
      <div>
        <nav className="flex items-center gap-2 text-outline text-[11px] uppercase tracking-widest mb-2">
          <button onClick={onBack} className="hover:text-primary transition-colors">
            Templates
          </button>
          <span className="material-symbols-outlined text-[12px]">chevron_right</span>
          <span className="text-primary">{isNew ? "Create Template" : `Edit ${heading}`}</span>
        </nav>
        <h1 className="font-headline-lg text-headline-lg text-primary">{heading}</h1>
      </div>
    </div>
  );
}

function VariablesTable({ variables }: { variables: TemplateVariable[] }) {
  return (
    <section className="space-y-stack-md">
      <div className="flex items-center justify-between px-2">
        <h3 className="font-headline-md text-headline-md text-primary">Dynamic Variables</h3>
        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
          {variables.length} Key{variables.length === 1 ? "" : "s"} Identified
        </span>
      </div>
      {variables.length === 0 ? (
        <p className="text-on-surface-variant font-body-md px-2">
          This template has no variables — it generates as-is.
        </p>
      ) : (
        <div className="border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant">
                  Key
                </th>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant">
                  Label
                </th>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant">
                  Type
                </th>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant">
                  Required
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant bg-white">
              {variables.map((v, i) => (
                <tr
                  key={v.key || i}
                  className={
                    i % 2 === 1
                      ? "bg-[#FAF8F5] hover:bg-surface-container-lowest transition-colors"
                      : "hover:bg-surface-container-lowest transition-colors"
                  }
                >
                  <td className="px-6 py-4 font-mono text-[12px] text-secondary">{v.key}</td>
                  <td className="px-6 py-4 font-body-md text-body-md">{v.label}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-surface-container rounded text-[11px] font-bold uppercase">
                      {v.type}
                    </span>
                  </td>
                  <td className={`px-6 py-4 ${v.required ? "text-primary" : "text-on-surface-variant"}`}>
                    <span
                      className={`material-symbols-outlined text-[18px] ${v.required ? "" : "opacity-20"}`}
                      style={v.required ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {v.required ? "check_circle" : "radio_button_unchecked"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
