import { Router } from "express";
import multer from "multer";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
import { extractText, MAX_UPLOAD_BYTES, UnsupportedFileError, FileParseError } from "../templates/fileExtract.js";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  createOwnedTemplate,
  updateTemplate,
  deleteTemplate,
  cloneTemplate,
  generateDocument,
  generateDocumentFromHtml,
  renderTitle,
  getBatch,
} from "../templates/service.js";
import { enqueueBriefBatch } from "../jobs/queue.js";
import { analyzeTemplate, draftTemplate, personalizeDocument } from "../agent/templateAgent.js";
import { requireLLM, isLLMAvailable } from "../llm/availability.js";
import { rateLimit } from "../middleware/rateLimit.js";

const tplLlmLimit = rateLimit({ bucket: "template-llm", max: 30, windowMs: 60 * 1000 });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});
import type {
  AnalyzeTemplateRequest,
  DraftTemplateRequest,
  GenerateBatchRequest,
  GenerateFromTemplateRequest,
  UpsertTemplateRequest,
} from "@docket/shared";

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

templatesRouter.get("/templates", async (req: AuthedRequest, res) => {
  res.json(await listTemplates(req.user!.id));
});

templatesRouter.get("/templates/:id", async (req: AuthedRequest, res) => {
  const t = await getTemplate(req.params.id!, req.user!.id);
  if (!t) return res.status(404).json({ error: "Template not found" });
  return res.json(t);
});

// Create an owned template from scratch (Create Template).
templatesRouter.post("/templates", async (req: AuthedRequest, res) => {
  const b = (req.body ?? {}) as UpsertTemplateRequest;
  if (!b.title || !b.bodyHtml) return res.status(400).json({ error: "title and bodyHtml required" });
  const t = await createOwnedTemplate(
    { title: b.title, category: b.category ?? "other", kind: b.kind ?? "contract", description: b.description ?? "", bodyHtml: b.bodyHtml, variables: b.variables ?? [] },
    req.user!.id,
  );
  return res.json(t);
});

// Update an owned template (builtins are read-only).
templatesRouter.put("/templates/:id", async (req: AuthedRequest, res) => {
  const b = (req.body ?? {}) as UpsertTemplateRequest;
  if (!b.title || !b.bodyHtml) return res.status(400).json({ error: "title and bodyHtml required" });
  const result = await updateTemplate(req.params.id!, req.user!.id, {
    title: b.title,
    category: b.category ?? "other",
    kind: b.kind ?? "contract",
    description: b.description ?? "",
    bodyHtml: b.bodyHtml,
    variables: b.variables ?? [],
  });
  if (result === "not_found") return res.status(404).json({ error: "Template not found" });
  if (result === "readonly") return res.status(403).json({ error: "System presets are read-only. Copy as a new template to edit." });
  return res.json(result);
});

templatesRouter.delete("/templates/:id", async (req: AuthedRequest, res) => {
  const result = await deleteTemplate(req.params.id!, req.user!.id);
  if (result === "not_found") return res.status(404).json({ error: "Template not found" });
  if (result === "readonly") return res.status(403).json({ error: "System presets cannot be deleted." });
  return res.json({ ok: true });
});

// Copy any visible template into an editable, firm-owned copy.
templatesRouter.post("/templates/:id/clone", async (req: AuthedRequest, res) => {
  const src = await getTemplate(req.params.id!, req.user!.id);
  if (!src) return res.status(404).json({ error: "Template not found" });
  const t = await cloneTemplate(src, req.user!.id);
  return res.json(t);
});

// Upload + analyze a firm's document into a reusable template.
templatesRouter.post("/templates/analyze", tplLlmLimit, requireLLM, async (req: AuthedRequest, res) => {
  const { text, title } = (req.body ?? {}) as AnalyzeTemplateRequest;
  if (!text || text.trim().length < 40) return res.status(400).json({ error: "Provide the document text to analyze" });
  try {
    const draft = await analyzeTemplate(text, title, req.user!.id);
    const t = await createTemplate(draft, "uploaded", req.user!.id);
    return res.json(t);
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
});

// Upload a real file (PDF / DOCX / TXT) — extract text server-side, then
// analyze it into a template exactly like the paste-text path.
templatesRouter.post(
  "/templates/analyze-file",
  tplLlmLimit,
  requireLLM,
  (req: AuthedRequest, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? `File is too large — the limit is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`
            : err.message;
        return res.status(400).json({ error: message });
      }
      if (err) return next(err);
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded (expected field 'file')" });
    // Confidentiality (invariant #7): log metadata only, never content.
    console.log(`[templates] analyzing upload: ${file.originalname} (${file.mimetype}, ${file.size}B)`);

    let text: string;
    try {
      text = await extractText(file.buffer, file.originalname);
    } catch (err) {
      const status = err instanceof UnsupportedFileError ? 415 : err instanceof FileParseError ? 422 : 500;
      return res.status(status).json({ error: (err as Error).message });
    }
    if (text.trim().length < 40) {
      return res.status(422).json({ error: "Could not find enough readable text in that file to build a template." });
    }

    const title = typeof req.body?.title === "string" && req.body.title.trim() ? req.body.title.trim() : undefined;
    try {
      const draft = await analyzeTemplate(text, title, req.user!.id);
      const t = await createTemplate(draft, "uploaded", req.user!.id);
      return res.json(t);
    } catch (err) {
      return res.status(502).json({ error: (err as Error).message });
    }
  },
);

// Viki drafts a new template from an instruction.
templatesRouter.post("/templates/draft", tplLlmLimit, requireLLM, async (req: AuthedRequest, res) => {
  const { instruction, useWebSearch } = (req.body ?? {}) as DraftTemplateRequest;
  if (!instruction) return res.status(400).json({ error: "instruction required" });
  try {
    const draft = await draftTemplate(instruction, Boolean(useWebSearch), req.user!.id);
    const t = await createTemplate(draft, "viki", req.user!.id);
    return res.json(t);
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
});

// Generate one case-specific document (form-fill and/or Viki-from-brief).
templatesRouter.post("/templates/:id/generate", tplLlmLimit, async (req: AuthedRequest, res) => {
  const t = await getTemplate(req.params.id!, req.user!.id);
  if (!t) return res.status(404).json({ error: "Template not found" });
  const { documentTitle, values, brief } = (req.body ?? {}) as GenerateFromTemplateRequest;
  if (!documentTitle) return res.status(400).json({ error: "documentTitle required" });

  // Viki-from-brief path: advanced case personalisation — Viki drafts the whole
  // document tailored to the matter (clause-level), not just a variable fill.
  if (brief && brief.trim()) {
    if (!isLLMAvailable()) return res.status(503).json({ error: "Viki is not configured (no ANTHROPIC_API_KEY). Use form-fill instead.", code: "llm_unavailable" });
    try {
      const personalized = await personalizeDocument(t, brief, req.user!.id);
      const documentId = await generateDocumentFromHtml(
        personalized.bodyHtml,
        documentTitle,
        t.kind,
        t.id,
        req.user!.id,
        req.user!.name,
        personalized.personalizationNotes,
      );
      return res.json({ documentId, personalizationNotes: personalized.personalizationNotes, unresolved: personalized.unresolved });
    } catch (err) {
      return res.status(502).json({ error: `Viki personalisation failed: ${(err as Error).message}` });
    }
  }

  // Pure form-fill path: deterministic {{variable}} substitution.
  const documentId = await generateDocument(t, documentTitle, values ?? {}, req.user!.id, req.user!.name);
  return res.json({ documentId });
});

// Batch: one document per row (deterministic form-fill, sync) OR one per brief
// (Viki-personalised, queued on the durable job queue → returns a batchId).
templatesRouter.post("/templates/:id/generate-batch", tplLlmLimit, async (req: AuthedRequest, res) => {
  const t = await getTemplate(req.params.id!, req.user!.id);
  if (!t) return res.status(404).json({ error: "Template not found" });
  const { titlePattern, rows, briefs } = (req.body ?? {}) as GenerateBatchRequest;
  if (!titlePattern) return res.status(400).json({ error: "titlePattern required" });

  // Brief-batch: heavy LLM fan-out → durable queue.
  if (Array.isArray(briefs) && briefs.length > 0) {
    if (!isLLMAvailable()) return res.status(503).json({ error: "Viki is not configured (no ANTHROPIC_API_KEY).", code: "llm_unavailable" });
    const batchId = await enqueueBriefBatch({
      templateId: t.id,
      titlePattern,
      briefs,
      ownerId: req.user!.id,
      ownerName: req.user!.name,
    });
    return res.json({ batchId });
  }

  // Values-batch: fast deterministic fill, synchronous.
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "Provide non-empty rows[] (form-fill) or briefs[] (Viki)" });
  }
  const documentIds: string[] = [];
  for (const row of rows) {
    const id = await generateDocument(t, renderTitle(titlePattern, row), row, req.user!.id, req.user!.name);
    documentIds.push(id);
  }
  return res.json({ documentIds });
});

// Poll a queued batch's progress.
templatesRouter.get("/batches/:batchId", async (req: AuthedRequest, res) => {
  const b = await getBatch(req.params.batchId!, req.user!.id);
  if (!b) return res.status(404).json({ error: "Batch not found" });
  return res.json(b);
});
