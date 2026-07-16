import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import type { TemplateDraft, TemplateDTO, TemplateSummary, TemplateVariable } from "@docket/shared";

type Row = Prisma.TemplateGetPayload<{}>;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function toTemplateDTO(row: Row): TemplateDTO {
  return {
    id: row.id,
    title: row.title,
    category: row.category as TemplateDTO["category"],
    kind: row.kind as TemplateDTO["kind"],
    description: row.description,
    bodyHtml: row.bodyHtml,
    variables: row.variables as unknown as TemplateVariable[],
    source: row.source as TemplateDTO["source"],
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSummary(row: Row): TemplateSummary {
  const variables = row.variables as unknown as TemplateVariable[];
  return {
    id: row.id,
    title: row.title,
    category: row.category as TemplateSummary["category"],
    kind: row.kind as TemplateSummary["kind"],
    description: row.description,
    source: row.source as TemplateSummary["source"],
    variableCount: variables.length,
  };
}

/**
 * Substitute {{key}} placeholders. Missing/blank values render as a visible,
 * highlighted blank so the reviewer immediately sees what still needs filling
 * (never silently drop a required field).
 */
export function render(bodyHtml: string, values: Record<string, string>, variables: TemplateVariable[]): string {
  const byKey = new Map(variables.map((v) => [v.key, v]));
  return bodyHtml.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const raw = values[key];
    if (raw != null && raw.trim() !== "") return escapeHtml(raw);
    const label = byKey.get(key)?.label ?? key;
    return `<span class="tpl-blank" data-key="${escapeHtml(key)}">[${escapeHtml(label)}]</span>`;
  });
}

/** Resolve {{key}} inside a plain-text title pattern (for batch). */
export function renderTitle(pattern: string, values: Record<string, string>): string {
  return pattern.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => values[key]?.trim() || key);
}

export async function listTemplates(userId: string): Promise<TemplateSummary[]> {
  const rows = await prisma.template.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: userId }] },
    orderBy: [{ source: "asc" }, { category: "asc" }, { title: "asc" }],
  });
  return rows.map(toSummary);
}

export async function getTemplate(id: string, userId: string): Promise<TemplateDTO | null> {
  const row = await prisma.template.findUnique({ where: { id } });
  if (!row) return null;
  if (row.ownerId && row.ownerId !== userId) return null;
  return toTemplateDTO(row);
}

/** Clone any visible template into a new firm-owned, editable copy ("Copy as New Template"). */
export async function cloneTemplate(source: TemplateDTO, ownerId: string): Promise<TemplateDTO> {
  const row = await prisma.template.create({
    data: {
      ownerId,
      title: `${source.title} (copy)`,
      category: source.category,
      kind: source.kind,
      description: source.description,
      bodyHtml: source.bodyHtml,
      variables: source.variables as unknown as Prisma.InputJsonValue,
      source: "uploaded",
    },
  });
  return toTemplateDTO(row);
}

/** Create an owned template from scratch (Create Template). */
export async function createOwnedTemplate(
  body: { title: string; category: string; kind: string; description: string; bodyHtml: string; variables: TemplateVariable[] },
  ownerId: string,
): Promise<TemplateDTO> {
  const row = await prisma.template.create({
    data: {
      ownerId,
      title: body.title,
      category: body.category,
      kind: body.kind,
      description: body.description,
      bodyHtml: body.bodyHtml,
      variables: body.variables as unknown as Prisma.InputJsonValue,
      source: "uploaded",
    },
  });
  return toTemplateDTO(row);
}

/** Update an owned template. Builtins (ownerId null) are read-only. */
export async function updateTemplate(
  id: string,
  ownerId: string,
  body: { title: string; category: string; kind: string; description: string; bodyHtml: string; variables: TemplateVariable[] },
): Promise<TemplateDTO | "not_found" | "readonly"> {
  const existing = await prisma.template.findUnique({ where: { id } });
  if (!existing) return "not_found";
  if (existing.ownerId == null) return "readonly";
  if (existing.ownerId !== ownerId) return "not_found";
  const row = await prisma.template.update({
    where: { id },
    data: {
      title: body.title,
      category: body.category,
      kind: body.kind,
      description: body.description,
      bodyHtml: body.bodyHtml,
      variables: body.variables as unknown as Prisma.InputJsonValue,
    },
  });
  return toTemplateDTO(row);
}

export async function deleteTemplate(id: string, ownerId: string): Promise<"ok" | "not_found" | "readonly"> {
  const existing = await prisma.template.findUnique({ where: { id } });
  if (!existing) return "not_found";
  if (existing.ownerId == null) return "readonly";
  if (existing.ownerId !== ownerId) return "not_found";
  await prisma.template.delete({ where: { id } });
  return "ok";
}

export async function createTemplate(draft: TemplateDraft, source: "uploaded" | "viki", ownerId: string): Promise<TemplateDTO> {
  const row = await prisma.template.create({
    data: {
      ownerId,
      title: draft.title,
      category: draft.category,
      kind: draft.kind,
      description: draft.description,
      bodyHtml: draft.bodyHtml,
      variables: draft.variables as unknown as Prisma.InputJsonValue,
      source,
    },
  });
  return toTemplateDTO(row);
}

/**
 * Generate a case-specific Document from a template. The instantiated HTML is
 * stored as `initialHtml`; the client seeds it into the (empty) Yjs doc on
 * first open, so content flows through the real Tiptap schema.
 */
export async function generateDocument(
  template: TemplateDTO,
  documentTitle: string,
  values: Record<string, string>,
  ownerId: string,
  ownerName: string,
): Promise<string> {
  const html = render(template.bodyHtml, values, template.variables);
  const doc = await prisma.document.create({
    data: {
      title: documentTitle,
      kind: template.kind,
      ownerId,
      initialHtml: html,
      templateId: template.id,
      members: { create: { userId: ownerId, role: "owner" } },
    },
  });
  await prisma.auditEvent.create({
    data: {
      documentId: doc.id,
      type: "version_saved",
      userId: ownerId,
      userName: ownerName,
      detail: { generatedFromTemplate: template.title },
    },
  });
  return doc.id;
}

/**
 * Create a Document from already-final HTML (the Viki-personalised path, where
 * the whole body has been drafted for the case). Records what was personalised.
 */
export async function generateDocumentFromHtml(
  html: string,
  documentTitle: string,
  kind: TemplateDTO["kind"],
  templateId: string,
  ownerId: string,
  ownerName: string,
  personalizationNotes: string[],
): Promise<string> {
  const doc = await prisma.document.create({
    data: {
      title: documentTitle,
      kind,
      ownerId,
      initialHtml: html,
      templateId,
      members: { create: { userId: ownerId, role: "owner" } },
    },
  });
  await prisma.auditEvent.create({
    data: {
      documentId: doc.id,
      type: "version_saved",
      userId: ownerId,
      userName: ownerName,
      detail: {
        generatedFromTemplate: templateId,
        personalized: true,
        notes: personalizationNotes.slice(0, 10).join(" • ").slice(0, 900),
      },
    },
  });
  return doc.id;
}
