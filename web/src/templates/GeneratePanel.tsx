import { useEffect, useMemo, useState } from "react";
import type { BatchStatus, TemplateDTO, TemplateVariable } from "@docket/shared";
import { batchesApi, templatesApi } from "@/lib/api";
import { substitutePreview, substituteText } from "./substitute";

type Mode = "form" | "brief" | "batch";

const MODES: { id: Mode; label: string }[] = [
  { id: "form", label: "Form Fill" },
  { id: "brief", label: "From Brief" },
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
      <div className="max-w-container-max-width mx-auto px-margin-page py-stack-lg">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span className="font-label-md text-label-md uppercase">Back to Library</span>
        </button>
        <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 font-body-md mt-stack-md">
          {loadError}
        </div>
      </div>
    );
  }
  if (!tpl) {
    return (
      <div className="max-w-container-max-width mx-auto px-margin-page py-stack-lg">
        <div className="text-on-surface-variant font-body-md italic py-stack-lg">
          Loading the template…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-container-max-width mx-auto px-margin-page py-stack-lg">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors mb-stack-md"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        <span className="font-label-md text-label-md uppercase">Back to Library</span>
      </button>

      <div className="border-b border-outline-variant pb-stack-md mb-stack-lg">
        <h1 className="font-headline-md text-headline-md text-primary">{tpl.title}</h1>
        <p className="text-on-surface-variant font-body-md mt-1">{tpl.description}</p>
      </div>

      <nav className="flex border-b border-outline-variant gap-6 mb-stack-lg">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={
              mode === m.id
                ? "px-1 py-3 font-label-md text-label-md border-b-2 border-brass text-primary transition-all"
                : "px-1 py-3 font-label-md text-label-md border-b-2 border-transparent text-on-surface-variant hover:text-primary transition-all"
            }
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
    <div className="flex flex-col lg:flex-row gap-stack-lg">
      <div className="w-full lg:w-[380px] shrink-0 space-y-stack-md">
        <label className="block">
          <span className="block font-label-md text-label-md uppercase text-on-surface-variant mb-1">
            Document title
          </span>
          <input
            className="w-full bg-transparent border-0 border-b border-outline-variant focus:ring-0 focus:border-secondary focus:outline-none p-0 pb-2 font-body-md transition-colors"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        {tpl.variables.map((v) => (
          <VariableInput key={v.key} variable={v} value={values[v.key] ?? ""} onChange={set} />
        ))}

        {error && (
          <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 font-body-md">
            {error}
          </div>
        )}
        {missingRequired.length > 0 && (
          <p className="text-on-surface-variant font-label-sm text-label-sm italic">
            {missingRequired.length} required field
            {missingRequired.length === 1 ? "" : "s"} still empty — you can still generate and
            fill the blanks in the editor.
          </p>
        )}

        <button
          className="w-full bg-primary text-on-primary py-stack-md font-label-md text-label-md rounded-lg hover:opacity-90 active:opacity-80 transition-all disabled:opacity-50"
          onClick={generate}
          disabled={busy || !title.trim()}
        >
          {busy ? "Generating document…" : "Generate document"}
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-on-surface-variant font-label-sm text-[11px] uppercase tracking-widest mb-stack-sm">
          Live preview
        </div>
        <div
          className="tpl-preview-doc bg-white border border-outline-variant rounded-xl shadow-[0_10px_30px_-10px_rgba(28,37,48,0.08)] p-12 font-serif text-body-lg leading-[1.8] text-on-surface min-h-[400px]"
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
  const underlineInput =
    "w-full bg-transparent border-0 border-b border-outline-variant focus:ring-0 focus:border-secondary focus:outline-none p-0 pb-2 font-body-md transition-colors";
  return (
    <label className="block">
      <span className="block font-label-md text-label-md uppercase text-on-surface-variant mb-1">
        {label}
        {required && <span className="text-error"> *</span>}
      </span>
      {type === "longtext" ? (
        <textarea
          rows={3}
          className="w-full bg-transparent border border-outline-variant rounded-sm focus:ring-0 focus:border-secondary focus:outline-none p-2 font-body-md transition-colors resize-none"
          {...common}
        />
      ) : type === "date" ? (
        <input type="date" className={underlineInput} {...common} />
      ) : type === "amount" ? (
        <div className="flex items-center border-b border-outline-variant focus-within:border-secondary transition-colors">
          <span className="pr-2 font-body-md text-on-surface-variant">INR</span>
          <input
            type="number"
            inputMode="decimal"
            className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none p-0 pb-2 font-body-md"
            {...common}
          />
        </div>
      ) : type === "number" ? (
        <input type="number" inputMode="decimal" className={underlineInput} {...common} />
      ) : (
        <input type="text" className={underlineInput} {...common} />
      )}
      {hint && (
        <span className="block text-on-surface-variant font-label-sm text-label-sm mt-1">
          {hint}
        </span>
      )}
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
      <div className="max-w-2xl space-y-stack-md">
        <div className="bg-white border border-secondary/30 rounded-lg overflow-hidden shadow-sm">
          <div className="bg-secondary text-white px-stack-md py-stack-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            <span className="font-label-md text-label-md uppercase tracking-wide">
              Viki tailored this to your case
            </span>
          </div>
          <div className="p-stack-md space-y-stack-md">
            {result.notes.length > 0 ? (
              <ul className="space-y-1.5">
                {result.notes.map((n, i) => (
                  <li key={i} className="flex items-start gap-2 text-body-md font-body-md text-on-surface">
                    <span className="material-symbols-outlined text-[16px] text-success mt-0.5">
                      check_circle
                    </span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-on-surface-variant font-body-md">Document drafted from your brief.</p>
            )}

            {result.unresolved.length > 0 && (
              <div className="bg-secondary-container/40 border border-secondary/20 rounded-lg p-stack-sm">
                <p className="flex items-center gap-2 font-label-md text-label-md text-on-secondary-container mb-1">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  Confirm these details
                </p>
                <ul className="list-disc pl-5 text-body-md font-body-md text-on-surface space-y-0.5">
                  {result.unresolved.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
                <p className="text-on-surface-variant font-label-sm text-label-sm italic mt-2">
                  Left as <code className="font-mono">[TO CONFIRM: …]</code> blanks in the document.
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          className="w-full bg-primary text-on-primary py-stack-md font-label-md text-label-md rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
          onClick={() => onOpenDocument(result.documentId)}
        >
          Open document
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-stack-md">
      <div className="flex items-center gap-stack-sm text-secondary">
        <span className="material-symbols-outlined">auto_awesome</span>
        <span className="font-label-md text-label-md uppercase tracking-wide">Viki AI Assistant</span>
      </div>

      <label className="block">
        <span className="block font-label-md text-label-md uppercase text-on-surface-variant mb-1">
          Document title
        </span>
        <input
          className="w-full bg-transparent border-0 border-b border-outline-variant focus:ring-0 focus:border-secondary focus:outline-none p-0 pb-2 font-body-md transition-colors"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="block font-label-md text-label-md uppercase text-on-surface-variant mb-1">
          Case brief
        </span>
        <textarea
          rows={8}
          className="w-full bg-surface border border-outline-variant rounded-sm p-4 font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary outline-none resize-none leading-relaxed transition-colors"
          placeholder="Describe the matter — parties, key dates, amounts, and any specifics. Viki fills the template's variables and tailors the draft."
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
      </label>

      {error && (
        <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 font-body-md">
          {error}
        </div>
      )}
      {busy && (
        <div className="flex items-center gap-2 text-secondary font-label-md text-label-md">
          <span
            className="inline-block w-3.5 h-3.5 rounded-full border-2 border-secondary/30 border-t-secondary animate-spin"
            aria-hidden="true"
          />
          Viki is preparing the document…
        </div>
      )}

      <button
        className="w-full py-stack-md bg-primary-container text-on-primary-container font-label-md text-label-md uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-all rounded-lg disabled:opacity-50"
        onClick={generate}
        disabled={busy || !title.trim() || !brief.trim()}
      >
        {busy ? "Preparing…" : "Process brief"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batch mode — two sub-modes: deterministic rows[] (sync) and briefs[] (queued)
// ---------------------------------------------------------------------------

type BatchSubMode = "rows" | "briefs";

function Batch({
  tpl,
  onOpenDocument,
}: {
  tpl: TemplateDTO;
  onOpenDocument: (id: string) => void;
}) {
  const [subMode, setSubMode] = useState<BatchSubMode>("rows");

  return (
    <div className="space-y-stack-lg">
      <div className="inline-flex bg-surface-container-high p-1 rounded-full border border-outline-variant">
        <button
          className={
            subMode === "rows"
              ? "px-4 py-1.5 rounded-full text-label-sm font-label-md bg-primary text-on-primary transition-all"
              : "px-4 py-1.5 rounded-full text-label-sm font-label-md text-on-surface-variant hover:bg-surface-container-highest transition-all"
          }
          onClick={() => setSubMode("rows")}
        >
          Rows
        </button>
        <button
          className={
            subMode === "briefs"
              ? "px-4 py-1.5 rounded-full text-label-sm font-label-md bg-primary text-on-primary transition-all"
              : "px-4 py-1.5 rounded-full text-label-sm font-label-md text-on-surface-variant hover:bg-surface-container-highest transition-all"
          }
          onClick={() => setSubMode("briefs")}
        >
          From briefs
        </button>
      </div>

      {subMode === "rows" ? (
        <BatchRows tpl={tpl} onOpenDocument={onOpenDocument} />
      ) : (
        <BatchFromBriefs tpl={tpl} onOpenDocument={onOpenDocument} />
      )}
    </div>
  );
}

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

function BatchRows({
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
      // rows[] always takes the synchronous form-fill path (documentIds), never
      // the queued briefs[] path (batchId) — see docs/API_CONTRACT.md.
      setCreated("documentIds" in res ? res.documentIds : []);
    } catch {
      setError("Could not generate the batch.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-stack-md">
        <div className="font-label-md text-label-md text-primary uppercase tracking-wide">
          {created.length} document{created.length === 1 ? "" : "s"} created
        </div>
        <ul className="space-y-1">
          {created.map((id, i) => (
            <li key={id}>
              <button
                className="text-secondary hover:underline font-body-md"
                onClick={() => onOpenDocument(id)}
              >
                {substituteText(titlePattern, rows[i] ?? {}) || `Document ${i + 1}`}
              </button>
            </li>
          ))}
        </ul>
        <button
          className="px-6 py-2 border border-outline-variant rounded font-label-md text-label-md hover:bg-surface-container-high transition-all"
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
    <div className="space-y-stack-md">
      <label className="block">
        <span className="block font-label-md text-label-md uppercase text-on-surface-variant mb-1">
          Title pattern
        </span>
        <input
          className="w-full bg-transparent border-0 border-b border-outline-variant focus:ring-0 focus:border-secondary focus:outline-none p-0 pb-2 font-body-md transition-colors"
          value={titlePattern}
          onChange={(e) => setTitlePattern(e.target.value)}
          placeholder="e.g. NDA — {{counterparty}}"
        />
        <span className="block text-on-surface-variant font-label-sm text-label-sm mt-1">
          {"{{vars}}"} resolve per row. Columns, in order: {keys.join(", ") || "(none)"}
        </span>
      </label>

      <label className="block">
        <span className="block font-label-md text-label-md uppercase text-on-surface-variant mb-1">
          Paste rows (CSV or tab-separated)
        </span>
        <textarea
          rows={4}
          className="w-full bg-surface border border-outline-variant rounded-sm p-3 font-mono text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary outline-none transition-colors"
          placeholder={keys.join(", ")}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
      </label>
      <div className="flex gap-stack-sm">
        <button
          className="px-4 py-1.5 border border-outline-variant rounded font-label-md text-label-sm hover:bg-surface-container-high transition-all disabled:opacity-40"
          onClick={loadPaste}
          disabled={!paste.trim()}
        >
          Load pasted rows
        </button>
        <button
          className="px-4 py-1.5 border border-outline-variant rounded font-label-md text-label-sm hover:bg-surface-container-high transition-all"
          onClick={addRow}
        >
          + Add empty row
        </button>
      </div>

      {rows.length > 0 && (
        <div className="border border-outline-variant rounded-lg overflow-auto max-h-[360px]">
          <table className="w-full text-left font-label-sm">
            <thead className="bg-surface-container sticky top-0">
              <tr className="border-b border-outline-variant">
                {keys.map((k) => (
                  <th key={k} className="p-3 uppercase tracking-tighter text-on-surface-variant font-label-md">
                    {k}
                  </th>
                ))}
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-outline-variant/50 hover:bg-secondary/5">
                  {keys.map((k) => (
                    <td key={k} className="p-2">
                      <input
                        className="bg-transparent border-0 p-1.5 w-full focus:ring-0 focus:outline-none font-body-md"
                        value={row[k] ?? ""}
                        onChange={(e) => setCell(ri, k, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="p-2 text-right">
                    <button
                      className="material-symbols-outlined text-outline hover:text-error text-[18px]"
                      onClick={() => removeRow(ri)}
                      aria-label="Remove row"
                    >
                      close
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 font-body-md">
          {error}
        </div>
      )}
      {busy && <div className="text-on-surface-variant font-body-md italic">Generating {rows.length} documents…</div>}

      <button
        className="w-full bg-primary text-on-primary py-stack-md font-label-md text-label-md rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
        onClick={generate}
        disabled={busy || rows.length === 0 || !titlePattern.trim()}
      >
        {busy ? "Generating…" : `Generate ${rows.length || ""} document${rows.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}

/**
 * "From briefs" batch sub-mode: one case brief per line, personalised on the
 * durable queue. `generate-batch` with `briefs[]` returns `{batchId}` (not
 * `documentIds`) — poll `GET /api/batches/:batchId` until it stops running.
 */
function BatchFromBriefs({
  tpl,
  onOpenDocument,
}: {
  tpl: TemplateDTO;
  onOpenDocument: (id: string) => void;
}) {
  const [briefsText, setBriefsText] = useState("");
  const [titlePattern, setTitlePattern] = useState(tpl.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<BatchStatus | null>(null);

  const briefs = useMemo(
    () =>
      briefsText
        .split(/\r?\n/)
        .map((b) => b.trim())
        .filter((b) => b !== ""),
    [briefsText],
  );

  // Poll the batch every ~2.5s until it stops running. Self-scheduling
  // setTimeout so we never have two polls in flight; cleaned up on unmount
  // or when a new batch starts.
  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const s = await batchesApi.get(batchId!);
        if (cancelled) return;
        setStatus(s);
        if (s.status === "running") {
          timer = window.setTimeout(poll, 2500);
        }
      } catch {
        if (cancelled) return;
        timer = window.setTimeout(poll, 2500);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [batchId]);

  async function submit() {
    if (briefs.length === 0 || !titlePattern.trim() || busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await templatesApi.generateBatch(tpl.id, {
        titlePattern: titlePattern.trim(),
        briefs,
      });
      if ("batchId" in res) {
        setBatchId(res.batchId);
      } else {
        setError("Unexpected response starting the batch.");
      }
    } catch {
      setError("Could not start the batch.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setBatchId(null);
    setStatus(null);
    setBriefsText("");
    setError(null);
  }

  if (batchId) {
    const pct = status && status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;
    const pillClass =
      !status || status.status === "running"
        ? "bg-info-container text-info"
        : status.status === "complete"
          ? "bg-success-container text-success"
          : "bg-error-container text-on-error-container";
    const pillLabel = !status
      ? "Starting…"
      : status.status === "running"
        ? "Drafting"
        : status.status === "complete"
          ? "Complete"
          : "Failed";

    return (
      <div className="max-w-2xl space-y-stack-md">
        <div className="flex items-center justify-between">
          <span className="font-headline-md text-headline-md text-primary">{pct}% complete</span>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-label-md uppercase tracking-tight ${pillClass}`}
          >
            {pillLabel}
          </span>
        </div>
        <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-on-surface-variant font-label-md text-label-md">
          {status ? `${status.done} of ${status.total} finalized` : "Contacting the batch queue…"}
          {status && status.failed > 0 ? ` · ${status.failed} failed` : ""}
        </p>

        {status && status.documentIds.length > 0 && (
          <ul className="space-y-1">
            {status.documentIds.map((id, i) => (
              <li key={id}>
                <button
                  className="text-secondary hover:underline font-body-md"
                  onClick={() => onOpenDocument(id)}
                >
                  {(briefs[i]?.slice(0, 60) || `Document ${i + 1}`) +
                    (briefs[i] && briefs[i].length > 60 ? "…" : "")}
                </button>
              </li>
            ))}
          </ul>
        )}

        {status && status.errors.length > 0 && (
          <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3">
            <p className="font-label-md text-label-md mb-1">
              {status.errors.length} error{status.errors.length === 1 ? "" : "s"}
            </p>
            <ul className="list-disc pl-5 font-body-md text-body-md space-y-0.5">
              {status.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {status && status.status !== "running" && (
          <button
            className="px-6 py-2 border border-outline-variant rounded font-label-md text-label-md hover:bg-surface-container-high transition-all"
            onClick={reset}
          >
            Start another batch
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-stack-md">
      <div className="flex items-center gap-stack-sm text-secondary">
        <span className="material-symbols-outlined">auto_awesome</span>
        <span className="font-label-md text-label-md uppercase tracking-wide">
          Viki personalises one document per brief
        </span>
      </div>

      <label className="block">
        <span className="block font-label-md text-label-md uppercase text-on-surface-variant mb-1">
          Title pattern
        </span>
        <input
          className="w-full bg-transparent border-0 border-b border-outline-variant focus:ring-0 focus:border-secondary focus:outline-none p-0 pb-2 font-body-md transition-colors"
          value={titlePattern}
          onChange={(e) => setTitlePattern(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="block font-label-md text-label-md uppercase text-on-surface-variant mb-1">
          Case briefs — one per line
        </span>
        <textarea
          rows={8}
          className="w-full bg-surface border border-outline-variant rounded-sm p-4 font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary outline-none resize-none leading-relaxed transition-colors"
          placeholder={
            "e.g.\nClient X vs Y — logistics contract dispute, ₹12,00,000 claim, breach of SLA in March 2024.\nClient A vs B — commercial lease dispute, notice of termination served 2024-01-15."
          }
          value={briefsText}
          onChange={(e) => setBriefsText(e.target.value)}
        />
        <span className="block text-on-surface-variant font-label-sm text-label-sm mt-1">
          {briefs.length} brief{briefs.length === 1 ? "" : "s"} detected
        </span>
      </label>

      {error && (
        <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 font-body-md">
          {error}
        </div>
      )}

      <button
        className="w-full bg-primary text-on-primary py-stack-md font-label-md text-label-md rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
        onClick={submit}
        disabled={busy || briefs.length === 0 || !titlePattern.trim()}
      >
        {busy
          ? "Starting…"
          : `Generate ${briefs.length || ""} document${briefs.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
