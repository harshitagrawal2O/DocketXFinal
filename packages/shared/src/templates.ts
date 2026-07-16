/**
 * Template library: reusable, fillable document skeletons that get instantiated
 * into case-specific Documents. Three sources: builtin (curated standard-form
 * Indian templates), uploaded (a firm's own doc, analyzed into a template), and
 * viki (drafted by the agent).
 */

export type TemplateCategory =
  | "agreement"
  | "corporate"
  | "employment"
  | "litigation"
  | "property"
  | "tax-ca"
  | "notice"
  | "other";

export type TemplateSource = "builtin" | "uploaded" | "viki";

export type VariableType = "text" | "longtext" | "date" | "number" | "amount" | "party";

export interface TemplateVariable {
  /** Placeholder key used as {{key}} in bodyHtml. */
  key: string;
  label: string;
  type: VariableType;
  required: boolean;
  hint?: string;
  defaultValue?: string;
}

export interface TemplateDTO {
  id: string;
  title: string;
  category: TemplateCategory;
  kind: "contract" | "opinion" | "filing" | "memo";
  description: string;
  /** HTML body containing {{variable}} placeholders. */
  bodyHtml: string;
  variables: TemplateVariable[];
  source: TemplateSource;
  ownerId?: string | null; // null = builtin/global
  createdAt: string;
}

export interface TemplateSummary {
  id: string;
  title: string;
  category: TemplateCategory;
  kind: TemplateDTO["kind"];
  description: string;
  source: TemplateSource;
  variableCount: number;
}

/** Shape used to author builtin templates and returned by Viki analyze/draft. */
export type TemplateDraft = Omit<TemplateDTO, "id" | "ownerId" | "createdAt" | "source">;

// ---- Requests ----

export interface AnalyzeTemplateRequest {
  title?: string;
  /** Raw pasted/uploaded document text to turn into a fillable template. */
  text: string;
}

export interface DraftTemplateRequest {
  instruction: string;
  useWebSearch?: boolean;
}

export interface GenerateFromTemplateRequest {
  documentTitle: string;
  /** Form-fill path: explicit variable values. */
  values?: Record<string, string>;
  /** Viki-from-brief path: a case brief Viki uses to fill variables + tailor. */
  brief?: string;
}

export interface GenerateBatchRequest {
  /** e.g. "NDA — {{counterparty}}"; {{vars}} resolved per row. */
  titlePattern: string;
  rows: Record<string, string>[];
}

/** Create/update a template manually (Create Template / edit an owned one). */
export interface UpsertTemplateRequest {
  title: string;
  category: TemplateCategory;
  kind: TemplateDTO["kind"];
  description: string;
  bodyHtml: string;
  variables: TemplateVariable[];
}

export interface GenerateResult {
  documentId: string;
  /** Present on the Viki-from-brief path: what Viki tailored to the case. */
  personalizationNotes?: string[];
  /** Facts the brief did not supply that a lawyer should confirm. */
  unresolved?: string[];
}

export interface GenerateBatchResult {
  documentIds: string[];
}
