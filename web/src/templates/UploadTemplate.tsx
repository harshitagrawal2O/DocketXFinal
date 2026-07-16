import { useState } from "react";
import type { TemplateDTO } from "@docket/shared";
import { templatesApi } from "@/lib/api";

type Tab = "upload" | "draft";

interface Props {
  onBack: () => void;
  /** Called with the newly-created template so the caller can open its Generate panel. */
  onCreated: (tpl: TemplateDTO) => void;
}

export function UploadTemplate({ onBack, onCreated }: Props) {
  const [tab, setTab] = useState<Tab>("upload");

  // Upload / analyze state
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  // Draft state
  const [instruction, setInstruction] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const tpl = await templatesApi.analyze({
        text: text.trim(),
        title: title.trim() || undefined,
      });
      onCreated(tpl);
    } catch {
      setError("Viki could not turn that document into a template.");
      setBusy(false);
    }
  }

  async function draft() {
    if (!instruction.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const tpl = await templatesApi.draft({
        instruction: instruction.trim(),
        useWebSearch,
      });
      onCreated(tpl);
    } catch {
      setError("Viki could not draft that template.");
      setBusy(false);
    }
  }

  return (
    <div className="templates-view">
      <header className="templates-head">
        <div>
          <button className="btn btn-sm" onClick={onBack}>
            ← Back to templates
          </button>
          <h2 className="generate-title">New template</h2>
          <p className="muted">
            Turn one of your firm's documents into a fillable template, or ask Viki to draft one.
          </p>
        </div>
      </header>

      <nav className="mode-tabs">
        <button className={tab === "upload" ? "active" : ""} onClick={() => setTab("upload")}>
          Upload &amp; analyze
        </button>
        <button className={tab === "draft" ? "active" : ""} onClick={() => setTab("draft")}>
          Draft with Viki
        </button>
      </nav>

      {tab === "upload" ? (
        <div className="generate-form">
          <label className="field">
            <span>Title (optional)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mutual NDA"
            />
          </label>
          <label className="field">
            <span>Document text</span>
            <textarea
              rows={12}
              placeholder="Paste the full text of the document. Viki finds the variable spots and turns it into a fillable template."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>

          {error && <div className="error-line">{error}</div>}
          {busy && <div className="intent-line">Viki is analyzing the document…</div>}

          <button
            className="btn btn-primary btn-block"
            onClick={analyze}
            disabled={busy || !text.trim()}
          >
            {busy ? "Analyzing…" : "Analyze into template"}
          </button>
        </div>
      ) : (
        <div className="generate-form">
          <label className="field">
            <span>Instruction</span>
            <textarea
              rows={6}
              placeholder="Describe the template you need — e.g. 'A founder employment agreement for an Indian private limited company with a 1-year cliff.'"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </label>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={useWebSearch}
              onChange={(e) => setUseWebSearch(e.target.checked)}
            />
            <span>Search the web for current formats</span>
          </label>

          {error && <div className="error-line">{error}</div>}
          {busy && (
            <div className="intent-line">
              {useWebSearch
                ? "Viki is researching current formats and drafting the template…"
                : "Viki is drafting the template…"}
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            onClick={draft}
            disabled={busy || !instruction.trim()}
          >
            {busy ? "Drafting…" : "Draft with Viki"}
          </button>
        </div>
      )}
    </div>
  );
}
