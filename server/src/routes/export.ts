import { Router } from "express";
import HTMLtoDOCX from "html-to-docx";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
import { requireTenantDb } from "../auth/org.js";
import { getRole } from "../auth/roles.js";

export const exportRouter = Router();
exportRouter.use(requireAuth, requireTenantDb);

/**
 * Convert the current document HTML (sent by the client, which owns the live
 * Tiptap content) into a real .docx for the firm to edit in Word. Print and
 * Save-as-PDF are handled client-side via a print stylesheet.
 */
exportRouter.post("/documents/:id/export/docx", async (req: AuthedRequest, res) => {
  const role = await getRole(req.tenantDb!, req.params.id!, req.user!.id);
  if (!role) return res.status(403).json({ error: "Not a member" });

  const { html, title } = req.body ?? {};
  if (typeof html !== "string") return res.status(400).json({ error: "html required" });

  const safeTitle = String(title ?? "document").replace(/[^a-z0-9 _-]/gi, "").trim() || "document";
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body>${html}</body></html>`;

  const buffer = (await HTMLtoDOCX(doc, undefined, {
    orientation: "portrait",
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch (twips)
    title: safeTitle,
  })) as Buffer;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.docx"`);
  return res.send(buffer);
});
