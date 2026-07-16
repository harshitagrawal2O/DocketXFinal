import { useCallback, useRef, useState } from "react";
import type { TemplateDTO } from "@docket/shared";
import { templatesApi } from "@/lib/api";

interface Props {
  onBack: () => void;
  /** Called with the newly-created template so the caller can open its Generate panel. */
  onCreated: (tpl: TemplateDTO) => void;
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];
const MAX_FILE_BYTES = 20 * 1024 * 1024; // mirrors the server limit

function fileExt(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  const group = m?.[1];
  return group ? `.${group.toLowerCase()}` : "";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForFile(name: string): string {
  const ext = fileExt(name);
  if (ext === ".pdf") return "picture_as_pdf";
  if (ext === ".docx") return "description";
  return "article";
}

function validateFile(file: File): string | null {
  const ext = fileExt(file.name);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `Unsupported file type (${ext || "unknown"}). Upload a .pdf, .docx, .txt, or .md file.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `File is too large (${formatBytes(file.size)}) — the limit is 20 MB.`;
  }
  return null;
}

export function UploadTemplate({ onBack, onCreated }: Props) {
  // Upload / analyze state
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [text, setText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    const problem = validateFile(f);
    if (problem) {
      setAnalyzeError(problem);
      setFile(null);
      return;
    }
    setAnalyzeError(null);
    setFile(f);
  }

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  }, []);

  // Draft state
  const [instruction, setInstruction] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const canAnalyze = pasteMode ? text.trim().length > 0 : file !== null;

  async function analyze() {
    if (!canAnalyze || analyzing) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const tpl =
        pasteMode || !file
          ? await templatesApi.analyze({ text: text.trim(), title: title.trim() || undefined })
          : await templatesApi.analyzeFile(file, title.trim() || undefined);
      onCreated(tpl);
    } catch (err) {
      setAnalyzeError(
        err instanceof Error && err.message ? err.message : "Viki could not turn that document into a template.",
      );
      setAnalyzing(false);
    }
  }

  async function draft() {
    if (!instruction.trim() || drafting) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const tpl = await templatesApi.draft({
        instruction: instruction.trim(),
        useWebSearch,
      });
      onCreated(tpl);
    } catch {
      setDraftError("Viki could not draft that template.");
      setDrafting(false);
    }
  }

  return (
    <div className="max-w-container-max-width mx-auto px-margin-page py-stack-lg">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors mb-stack-md"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        <span className="font-label-md text-label-md uppercase">Back to Templates</span>
      </button>

      <div className="mb-stack-lg">
        <h1 className="font-headline-lg text-headline-lg text-primary mb-1">Intake New Document</h1>
        <p className="text-on-surface-variant font-body-md">
          Turn one of your firm's documents into a fillable template, or ask Viki to draft one
          from scratch.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter items-stretch">
        {/* Upload & analyze */}
        <div className="bg-white border border-outline-variant/60 rounded-xl p-stack-lg flex flex-col shadow-[0_20px_40px_-10px_rgba(28,37,48,0.06)]">
          <div className="mb-stack-lg">
            <div className="w-12 h-12 bg-primary-fixed flex items-center justify-center rounded-lg mb-stack-md">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                upload_file
              </span>
            </div>
            <h2 className="font-headline-md text-headline-md text-primary">Upload &amp; analyze</h2>
            <p className="font-body-md text-on-surface-variant mt-1">
              Upload an existing draft (PDF, Word, or text) — Viki finds the variable spots and
              turns it into a fillable template.
            </p>
          </div>

          <label className="block mb-stack-md">
            <span className="block font-label-md text-label-md uppercase text-on-surface-variant mb-1">
              Title (optional)
            </span>
            <input
              className="w-full bg-transparent border-0 border-b border-outline-variant focus:ring-0 focus:border-secondary focus:outline-none p-0 pb-2 font-body-md transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mutual NDA"
            />
          </label>

          {!pasteMode ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`flex-grow flex flex-col items-center justify-center text-center border-2 border-dashed rounded-lg transition-colors relative overflow-hidden mb-stack-md min-h-[220px] p-stack-lg ${
                dragActive
                  ? "border-primary bg-primary-container/10"
                  : "border-outline-variant bg-surface-container-low hover:border-primary cursor-pointer"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(",")}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />

              {analyzing && (
                <div className="absolute inset-0 bg-surface-container-low/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-stack-lg text-center">
                  <div className="w-48 h-1 bg-outline-variant rounded-full overflow-hidden relative mb-stack-md">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brass/40 to-transparent animate-pulse" />
                  </div>
                  <p className="font-label-md text-label-md text-primary animate-pulse">
                    Viki is analyzing the document…
                  </p>
                  <p className="text-on-surface-variant text-label-sm font-label-sm mt-1">
                    Extracting text &amp; identifying clause structure
                  </p>
                </div>
              )}

              {file ? (
                <div
                  className="flex items-center gap-3 bg-white border border-outline-variant/60 rounded-lg px-4 py-3 shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="material-symbols-outlined text-2xl text-secondary">
                    {iconForFile(file.name)}
                  </span>
                  <div className="text-left">
                    <p className="font-label-md text-label-md text-primary truncate max-w-[220px]">
                      {file.name}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => pickFile(null)}
                    className="ml-2 text-outline hover:text-error transition-colors"
                    aria-label="Remove file"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-4xl text-outline mb-stack-sm">
                    cloud_upload
                  </span>
                  <p className="font-label-md text-label-md text-on-surface-variant">
                    Drop a file here, or click to browse
                  </p>
                  <p className="text-label-sm text-outline mt-1">PDF, DOCX, or TXT — up to 20MB</p>
                </>
              )}
            </div>
          ) : (
            <div className="flex-grow flex flex-col border-2 border-dashed border-outline-variant rounded-lg bg-surface-container-low relative overflow-hidden mb-stack-md min-h-[220px]">
              {analyzing && (
                <div className="absolute inset-0 bg-surface-container-low/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-stack-lg text-center">
                  <div className="w-48 h-1 bg-outline-variant rounded-full overflow-hidden relative mb-stack-md">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brass/40 to-transparent animate-pulse" />
                  </div>
                  <p className="font-label-md text-label-md text-primary animate-pulse">
                    Viki is analyzing the document…
                  </p>
                </div>
              )}
              <textarea
                className="flex-1 w-full bg-transparent border-0 p-stack-md font-body-md focus:ring-0 focus:outline-none resize-none placeholder:text-outline"
                rows={8}
                placeholder="Paste the full text of the document. Viki finds the variable spots and turns it into a fillable template."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setPasteMode((v) => !v);
              setAnalyzeError(null);
            }}
            className="self-start mb-stack-md text-label-sm font-label-sm text-secondary hover:underline"
          >
            {pasteMode ? "← Upload a file instead" : "Or paste the text instead"}
          </button>

          {analyzeError && (
            <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 font-body-md mb-stack-sm">
              {analyzeError}
            </div>
          )}

          <button
            className="w-full bg-primary text-on-primary py-stack-md font-label-md text-label-md rounded-lg hover:opacity-90 active:opacity-80 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={analyze}
            disabled={analyzing || !canAnalyze}
          >
            {analyzing ? "Analyzing…" : "Analyze into template"}
            {!analyzing && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
          </button>
        </div>

        {/* Draft with Viki */}
        <div className="bg-white border border-outline-variant/60 rounded-xl p-stack-lg flex flex-col shadow-[0_20px_40px_-10px_rgba(28,37,48,0.06)]">
          <div className="mb-stack-lg">
            <div className="w-12 h-12 bg-secondary-container flex items-center justify-center rounded-lg mb-stack-md">
              <span
                className="material-symbols-outlined text-secondary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
            </div>
            <h2 className="font-headline-md text-headline-md text-primary">Draft with Viki</h2>
            <p className="font-body-md text-on-surface-variant mt-1">
              Generate a fillable template from natural-language instructions.
            </p>
          </div>

          <label className="flex-grow flex flex-col gap-1 mb-stack-md">
            <span className="font-label-md text-label-md uppercase text-on-surface-variant">
              Instruction
            </span>
            <textarea
              className="w-full flex-grow p-stack-md bg-background border border-outline-variant rounded-lg focus:ring-1 focus:ring-secondary focus:border-secondary font-body-md resize-none transition-all outline-none min-h-[140px]"
              rows={6}
              placeholder="e.g., Draft a Writ Petition for a stay on property demolition under Article 226 of the Constitution, citing urgency and lack of prior notice."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 mb-stack-lg font-label-sm text-label-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={useWebSearch}
              onChange={(e) => setUseWebSearch(e.target.checked)}
            />
            Search the web for current formats
          </label>

          {draftError && (
            <div className="bg-error-container text-on-error-container rounded-lg px-4 py-3 font-body-md mb-stack-sm">
              {draftError}
            </div>
          )}
          {drafting && (
            <div className="flex items-center gap-2 text-secondary font-label-md text-label-md mb-stack-sm">
              <span
                className="inline-block w-3.5 h-3.5 rounded-full border-2 border-secondary/30 border-t-secondary animate-spin"
                aria-hidden="true"
              />
              {useWebSearch
                ? "Viki is researching current formats and drafting the template…"
                : "Viki is drafting the template…"}
            </div>
          )}

          <button
            className="w-full border border-secondary text-secondary py-stack-md font-label-md text-label-md rounded-lg hover:bg-secondary-container/10 active:opacity-80 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={draft}
            disabled={drafting || !instruction.trim()}
          >
            {drafting ? "Drafting…" : "Draft template"}
            {!drafting && <span className="material-symbols-outlined text-sm">magic_button</span>}
          </button>
        </div>
      </div>

      <div className="mt-stack-lg p-stack-md bg-surface-container-high/50 rounded-lg flex items-center gap-stack-md border border-outline-variant/30">
        <span
          className="material-symbols-outlined text-secondary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          lightbulb
        </span>
        <p className="text-label-sm font-label-sm text-on-surface-variant">
          <span className="font-bold text-primary">Pro Tip:</span> Mention specific clause numbers
          or statutes to help Viki reference the right Acts precisely.
        </p>
      </div>
    </div>
  );
}
