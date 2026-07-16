import { useEffect, useMemo, useState } from "react";
import type { TemplateDTO, TemplateVariable } from "@docket/shared";
import { templatesApi } from "@/lib/api";
import { substitutePreview, substituteText } from "./substitute";

type Mode = "form" | "brief" | "batch";

const MODES: { id: Mode; label: string }[] = [
  { id: "form", label: "Form-fill" },
  { id: "brief", label: "From brief (Viki)" },
  { id: "batch", label: "Batch" },
];

interface Props {
  templateId: string;
  onBack: () => void;
  onOpenDocument: (id: string) => void;
}

export function GeneratePanel({ templateId, onBack, onOpenDocument }: Props) {
  const [tpl, setTpl] = useState<TemplateDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("form");

  useEffect(() => {
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
          ← Back to templates
        </button>
        <div className="error-line">{loadError}</div>
      </div>
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
    <div className="templates-view generate-panel">
      <header className="templates-head">
        <div>
          <button className="btn btn-sm" onClick={onBack}>
            ← Back to templates
          </button>
          <h2 className="generate-title">{tpl.title}</h2>
          <p className="muted">{tpl.description}</p>
        </div>
      </header>

      <nav className="mode-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={mode === m.id ? "active" : ""}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </nav>

      {mode === "form" && <FormFill tpl={tpl} onOpenDocument={onOpenDocument} />}
      {mode === "brief" && <FromBrief tpl={tpl} onOpenDocument={onOpenDocument} />}
      {mode === "batch" && <Batch tpl={tpl} onOpenDocument={onOpenDocument} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form-fill mode
// ---------------------------------------------------------------------------

function defaultValues(variables: TemplateVariable[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of variables) {
    if (v.defaultValue !== undefined) out[v.key] = v.defaultValue;
  }
  return out;
}

function FormFill({
  tpl,
  onOpenDocument,
}: {
  tpl: TemplateDTO;
  onOpenDocument: (id: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    defaultValues(tpl.variables),
  );
  const [title, setTitle] = useState(tpl.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewHtml = useMemo(
    () => substitutePreview(tpl.bodyHtml, tpl.variables, values),
    [tpl, values],
  );

  const missingRequired = tpl.variables.filter((v) => {
    const val = values[v.key];
    return v.required && (val === undefined || val.trim() === "");
  });

  function set(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function generate() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await templatesApi.generate(tpl.id, {
        documentTitle: title.trim(),
        values,
      });
      onOpenDocument(res.documentId);
    } catch {
      setError("Could not generate the document.");
      setBusy(false);
    }
  }

  return (
    <div className="generate-split">
      <div className="generate-form">
        <label className="field">
          <span>Document title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        {tpl.variables.map((v) => (
          <VariableInput key={v.key} variable={v} value={values[v.key] ?? ""} onChange={set} />
        ))}

        {error && <div className="error-line">{error}</div>}
        {missingRequired.length > 0 && (
          <p className="agent-hint muted">
            {missingRequired.length} required field
            {missingRequired.length === 1 ? "" : "s"} still empty — you can still generate and
            fill the blanks in the editor.
          </p>
        )}

        <button
          className="btn btn-primary btn-block"
          onClick={generate}
          disabled={busy || !title.trim()}
        >
          {busy ? "Generating document…" : "Generate document"}
        </button>
      </div>

      <div className="generate-preview">
        <div className="generate-preview-label muted">Live preview</div>
        <div
          className="tpl-preview-doc"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </div>
  );
}

function VariableInput({
  variable,
  value,
  onChange,
}: {
  variable: TemplateVariable;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  const { key, label, type, required, hint } = variable;
  const common = {
    value,
    onChange: (e: { target: { value: string } }) => onChange(key, e.target.value),
  };
  return (
    <label className="field">
      <span>
        {label}
        {required && <span className="tpl-req"> *</span>}
      </span>
      {type === "longtext" ? (
        <textarea rows={3} {...common} />
      ) : type === "date" ? (
        <input type="date" {...common} />
      ) : type === "amount" || type === "number" ? (
        <input type="number" inputMode="decimal" {...common} />
      ) : (
        <input type="text" {...common} />
      )}
      {hint && <span className="field-hint muted">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// From brief (Viki) mode
// ---------------------------------------------------------------------------

interface Personalization {
  documentId: string;
  notes: string[];
  unresolved: string[];
}

function FromBrief({
  tpl,
  onOpenDocument,
}: {
  tpl: TemplateDTO;
  onOpenDocument: (id: string) => void;
}) {
  const [title, setTitle] = useState(tpl.title);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Personalization | null>(null);

  async function generate() {
    if (!title.trim() || !brief.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await templatesApi.generate(tpl.id, {
        documentTitle: title.trim(),
        brief: brief.trim(),
      });
      const notes = res.personalizationNotes ?? [];
      const unresolved = res.unresolved ?? [];
      // If Viki reported what it tailored, show the summary and let the reviewer
      // read it before jumping into the document. Otherwise open straightaway.
      if (notes.length > 0 || unresolved.length > 0) {
        setResult({ documentId: res.documentId, notes, unresolved });
        setBusy(false);
      } else {
        onOpenDocument(res.documentId);
      }
    } catch {
      setError("Viki could not prepare the document.");
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="generate-form">
        <div className="personalization-card">
          <p className="personalization-title">✨ Viki tailored this to your case:</p>
          {result.notes.length > 0 ? (
            <ul className="personalization-notes">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Document drafted from your brief.</p>
          )}

          {result.unresolved.length > 0 && (
            <div className="unresolved-block">
              <p className="unresolved-title">⚠ Confirm these details:</p>
              <ul>
                {result.unresolved.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
              <p className="field-hint muted">
                Left as <code>[TO CONFIRM: …]</code> blanks in the document.
              </p>
            </div>
          )}
        </div>

        <button
          className="btn btn-primary btn-block"
          onClick={() => onOpenDocument(result.documentId)}
        >
          Open document →
        </button>
      </div>
    );
  }

  return (
    <div className="generate-form">
      <label className="field">
        <span>Document title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        <span>Case brief</span>
        <textarea
          rows={8}
          placeholder="Describe the matter — parties, key dates, amounts, and any specifics. Viki fills the template's variables and tailors the draft."
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
      </label>

      {error && <div className="error-line">{error}</div>}
      {busy && <div className="intent-line">Viki is preparing the document…</div>}

      <button
        className="btn btn-primary btn-block"
        onClick={generate}
        disabled={busy || !title.trim() || !brief.trim()}
      >
        {busy ? "Preparing…" : "Generate with Viki"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batch mode
// ---------------------------------------------------------------------------

function parseRows(raw: string, keys: string[]): Record<string, string>[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.map((line) => {
    const cells = line.includes("\t") ? line.split("\t") : line.split(",");
    const row: Record<string, string> = {};
    keys.forEach((k, i) => {
      row[k] = (cells[i] ?? "").trim();
    });
    return row;
  });
}

function Batch({
  tpl,
  onOpenDocument,
}: {
  tpl: TemplateDTO;
  onOpenDocument: (id: string) => void;
}) {
  const keys = tpl.variables.map((v) => v.key);
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [titlePattern, setTitlePattern] = useState(
    keys.length > 0 ? `${tpl.title} — {{${keys[0]}}}` : tpl.title,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string[] | null>(null);

  function loadPaste() {
    setRows((prev) => [...prev, ...parseRows(paste, keys)]);
    setPaste("");
  }

  function addRow() {
    const empty: Record<string, string> = {};
    keys.forEach((k) => (empty[k] = ""));
    setRows((prev) => [...prev, empty]);
  }

  function setCell(rowIndex: number, key: string, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)),
    );
  }

  function removeRow(rowIndex: number) {
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
  }

  async function generate() {
    if (rows.length === 0 || !titlePattern.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await templatesApi.generateBatch(tpl.id, {
        titlePattern: titlePattern.trim(),
        rows,
      });
      setCreated(res.documentIds);
    } catch {
      setError("Could not generate the batch.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="generate-form">
        <div className="feed-section-title">
          {created.length} document{created.length === 1 ? "" : "s"} created
        </div>
        <ul className="batch-result-list">
          {created.map((id, i) => (
            <li key={id}>
              <button className="link-btn" onClick={() => onOpenDocument(id)}>
                {substituteText(titlePattern, rows[i] ?? {}) || `Document ${i + 1}`}
              </button>
            </li>
          ))}
        </ul>
        <button
          className="btn btn-sm"
          onClick={() => {
            setCreated(null);
            setRows([]);
          }}
        >
          Start another batch
        </button>
      </div>
    );
  }

  return (
    <div className="generate-form">
      <label className="field">
        <span>Title pattern</span>
        <input
          value={titlePattern}
          onChange={(e) => setTitlePattern(e.target.value)}
          placeholder="e.g. NDA — {{counterparty}}"
        />
        <span className="field-hint muted">
          {"{{vars}}"} resolve per row. Columns, in order: {keys.join(", ") || "(none)"}
        </span>
      </label>

      <label className="field">
        <span>Paste rows (CSV or tab-separated)</span>
        <textarea
          rows={4}
          placeholder={keys.join(", ")}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
      </label>
      <div className="batch-toolbar">
        <button className="btn btn-sm" onClick={loadPaste} disabled={!paste.trim()}>
          Load pasted rows
        </button>
        <button className="btn btn-sm" onClick={addRow}>
          + Add empty row
        </button>
      </div>

      {rows.length > 0 && (
        <div className="batch-grid-wrap">
          <table className="batch-grid">
            <thead>
              <tr>
                {keys.map((k) => (
                  <th key={k}>{k}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {keys.map((k) => (
                    <td key={k}>
                      <input
                        value={row[k] ?? ""}
                        onChange={(e) => setCell(ri, k, e.target.value)}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={() => removeRow(ri)}
                      aria-label="Remove row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <div className="error-line">{error}</div>}
      {busy && <div className="intent-line">Generating {rows.length} documents…</div>}

      <button
        className="btn btn-primary btn-block"
        onClick={generate}
        disabled={busy || rows.length === 0 || !titlePattern.trim()}
      >
        {busy ? "Generating…" : `Generate ${rows.length || ""} document${rows.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
