import Anthropic from "@anthropic-ai/sdk";
import type { TemplateDraft, TemplateDTO, TemplateVariable } from "@docket/shared";

const MODEL = process.env.VIKI_MODEL ?? "claude-opus-4-8";
const WEB_SEARCH_ENABLED = process.env.VIKI_WEB_SEARCH === "true";

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

const REGISTER_TEMPLATE_TOOL: Anthropic.Tool = {
  name: "register_template",
  description:
    "Register a reusable, fillable document template. bodyHtml is clean semantic HTML (h1/h2/p/ol/ul/li/strong) with {{variable_key}} placeholders wherever a case-specific value goes. Every placeholder MUST have a matching entry in variables.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      category: { type: "string", enum: ["agreement", "corporate", "employment", "litigation", "property", "tax-ca", "notice", "other"] },
      kind: { type: "string", enum: ["contract", "opinion", "filing", "memo"] },
      description: { type: "string", description: "One-line description of when to use this template." },
      variables: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "snake_case; used as {{key}} in bodyHtml" },
            label: { type: "string" },
            type: { type: "string", enum: ["text", "longtext", "date", "number", "amount", "party"] },
            required: { type: "boolean" },
            hint: { type: "string" },
          },
          required: ["key", "label", "type", "required"],
        },
      },
      bodyHtml: { type: "string", description: "The template body as HTML with {{variable_key}} placeholders." },
    },
    required: ["title", "category", "kind", "description", "variables", "bodyHtml"],
  },
};

const DRAFT_SYSTEM = `You are Viki, drafting reusable legal/CA document templates for Indian law firms. Produce professional, standard-form templates in current Indian legal drafting style. Use the CURRENT statutory framework (e.g. Bharatiya Nyaya Sanhita 2023, not the repealed IPC; Companies Act 2013; CGST/IGST Acts 2017; Income-tax Act 1961; Arbitration and Conciliation Act 1996). Put {{variable_key}} placeholders everywhere a case-specific value belongs (parties, dates, amounts, jurisdiction, governing law seat, notice periods). Do NOT invent statute sections you are unsure exist. Always finish by calling register_template.`;

const ANALYZE_SYSTEM = `You are Viki, converting a firm's existing document into a reusable fillable template. Preserve the firm's wording and clause structure. Identify every case-specific value (party names, dates, amounts, addresses, jurisdiction, defined terms that change per matter) and replace each with a {{snake_case_key}} placeholder, recording it in variables with a sensible label, type and required flag. Keep boilerplate/clauses intact. Return clean HTML in bodyHtml. Always finish by calling register_template.`;

function draftFromToolUse(input: unknown): TemplateDraft {
  const i = input as {
    title: string;
    category: TemplateDraft["category"];
    kind: TemplateDraft["kind"];
    description: string;
    variables: TemplateVariable[];
    bodyHtml: string;
  };
  return {
    title: i.title,
    category: i.category,
    kind: i.kind,
    description: i.description ?? "",
    variables: (i.variables ?? []).map((v) => ({
      key: v.key,
      label: v.label,
      type: v.type,
      required: Boolean(v.required),
      hint: v.hint,
    })),
    bodyHtml: i.bodyHtml,
  };
}

function extractRegisterTemplate(msg: Anthropic.Message): TemplateDraft {
  const block = msg.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "register_template",
  );
  if (!block) throw new Error("Viki did not return a template");
  return draftFromToolUse(block.input);
}

/** Turn an uploaded document into a fillable template. */
export async function analyzeTemplate(text: string, title?: string): Promise<TemplateDraft> {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: ANALYZE_SYSTEM,
    tools: [REGISTER_TEMPLATE_TOOL],
    tool_choice: { type: "tool", name: "register_template" },
    messages: [
      {
        role: "user",
        content: `${title ? `Suggested title: ${title}\n\n` : ""}Convert this document into a reusable template:\n"""\n${text}\n"""`,
      },
    ],
  });
  return extractRegisterTemplate(msg);
}

/** Draft a brand-new template from an instruction (optionally web-search-backed). */
export async function draftTemplate(instruction: string, useWebSearch = false): Promise<TemplateDraft> {
  const tools: Anthropic.ToolUnion[] = [REGISTER_TEMPLATE_TOOL];
  const canSearch = useWebSearch && WEB_SEARCH_ENABLED;
  if (canSearch) {
    // Anthropic server-side web search tool; executed by the API within the turn.
    tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 3 } as unknown as Anthropic.ToolUnion);
  }
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: DRAFT_SYSTEM,
    tools,
    // Can't force register_template when a search may be needed first.
    tool_choice: canSearch ? { type: "auto" } : { type: "tool", name: "register_template" },
    messages: [{ role: "user", content: `Draft a template: ${instruction}` }],
  });
  return extractRegisterTemplate(msg);
}

const FILL_TOOL: Anthropic.Tool = {
  name: "fill_values",
  description: "Provide a value for each template variable, inferred from the case brief. Leave a value empty only if the brief truly does not supply it.",
  input_schema: {
    type: "object",
    properties: {
      values: {
        type: "array",
        items: {
          type: "object",
          properties: { key: { type: "string" }, value: { type: "string" } },
          required: ["key", "value"],
        },
      },
    },
    required: ["values"],
  },
};

/** Fill a template's variables from a free-text case brief. */
export async function fillTemplateFromBrief(
  template: Pick<TemplateDTO, "title" | "variables" | "bodyHtml">,
  brief: string,
): Promise<Record<string, string>> {
  const varSpec = template.variables.map((v) => `- ${v.key} (${v.type}${v.required ? ", required" : ""}): ${v.label}${v.hint ? ` — ${v.hint}` : ""}`).join("\n");
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system:
      "You are Viki, preparing a case-specific document from a template. Read the case brief and provide the best value for each variable. Use precise Indian legal drafting conventions. Do not invent facts the brief does not contain — leave a variable blank if truly unspecified. Always call fill_values.",
    tools: [FILL_TOOL],
    tool_choice: { type: "tool", name: "fill_values" },
    messages: [
      {
        role: "user",
        content: `Template: ${template.title}\n\nVariables:\n${varSpec}\n\nCase brief:\n"""\n${brief}\n"""`,
      },
    ],
  });
  const block = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "fill_values");
  if (!block) throw new Error("Viki did not return values");
  const input = block.input as { values: { key: string; value: string }[] };
  const out: Record<string, string> = {};
  for (const { key, value } of input.values ?? []) out[key] = value;
  return out;
}
