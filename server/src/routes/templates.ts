import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  generateDocument,
  renderTitle,
} from "../templates/service.js";
import { analyzeTemplate, draftTemplate, fillTemplateFromBrief } from "../agent/templateAgent.js";
import type {
  AnalyzeTemplateRequest,
  DraftTemplateRequest,
  GenerateBatchRequest,
  GenerateFromTemplateRequest,
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

  let merged: Record<string, string> = { ...(values ?? {}) };
  if (brief && brief.trim()) {
    try {
      const filled = await fillTemplateFromBrief(t, brief);
      // Explicit form values win over Viki's inferred values.
      merged = { ...filled, ...merged };
    } catch (err) {
      return res.status(502).json({ error: `Viki fill failed: ${(err as Error).message}` });
    }
  }
  const documentId = await generateDocument(t, documentTitle, merged, req.user!.id, req.user!.name);
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
