import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
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
} from "../templates/service.js";
import { analyzeTemplate, draftTemplate, personalizeDocument } from "../agent/templateAgent.js";
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
templatesRouter.post("/templates/analyze", async (req: AuthedRequest, res) => {
  const { text, title } = (req.body ?? {}) as AnalyzeTemplateRequest;
  if (!text || text.trim().length < 40) return res.status(400).json({ error: "Provide the document text to analyze" });
  try {
    const draft = await analyzeTemplate(text, title);
    const t = await createTemplate(draft, "uploaded", req.user!.id);
    return res.json(t);
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
});

// Viki drafts a new template from an instruction.
templatesRouter.post("/templates/draft", async (req: AuthedRequest, res) => {
  const { instruction, useWebSearch } = (req.body ?? {}) as DraftTemplateRequest;
  if (!instruction) return res.status(400).json({ error: "instruction required" });
  try {
    const draft = await draftTemplate(instruction, Boolean(useWebSearch));
    const t = await createTemplate(draft, "viki", req.user!.id);
    return res.json(t);
  } catch (err) {
    return res.status(502).json({ error: (err as Error).message });
  }
});

// Generate one case-specific document (form-fill and/or Viki-from-brief).
templatesRouter.post("/templates/:id/generate", async (req: AuthedRequest, res) => {
  const t = await getTemplate(req.params.id!, req.user!.id);
  if (!t) return res.status(404).json({ error: "Template not found" });
  const { documentTitle, values, brief } = (req.body ?? {}) as GenerateFromTemplateRequest;
  if (!documentTitle) return res.status(400).json({ error: "documentTitle required" });

  // Viki-from-brief path: advanced case personalisation — Viki drafts the whole
  // document tailored to the matter (clause-level), not just a variable fill.
  if (brief && brief.trim()) {
    try {
      const personalized = await personalizeDocument(t, brief);
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

// Batch: one document per row of values.
templatesRouter.post("/templates/:id/generate-batch", async (req: AuthedRequest, res) => {
  const t = await getTemplate(req.params.id!, req.user!.id);
  if (!t) return res.status(404).json({ error: "Template not found" });
  const { titlePattern, rows } = (req.body ?? {}) as GenerateBatchRequest;
  if (!titlePattern || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "titlePattern and non-empty rows[] required" });
  }
  const documentIds: string[] = [];
  for (const row of rows) {
    const id = await generateDocument(t, renderTitle(titlePattern, row), row, req.user!.id, req.user!.name);
    documentIds.push(id);
  }
  return res.json({ documentIds });
});
