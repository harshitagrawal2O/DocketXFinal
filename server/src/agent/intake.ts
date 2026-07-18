import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@prisma/client";
import { listTemplates, getTemplate, generateDocumentFromHtml } from "../templates/service.js";
import { personalizeDocument, draftDocumentFromScratch } from "./templateAgent.js";
import { recordUsage } from "./usage.js";
import { emitIntake, type IntakeSession } from "./intakeManager.js";
import { withLLMSlot } from "../llm/limiter.js";
import { resolveAnthropicApiKey } from "../llm/orgApiKey.js";
import type { IntakeTemplateMatch } from "@docket/shared";

const MODEL = process.env.VIKI_MODEL ?? "claude-opus-4-8";
const MAX_TOOL_ITERS = 3;

export const GREETING =
  "Hi, I'm Viki — I help draft legal and CA documents. What do you need today? Tell me in plain words (for example: \"a mutual NDA with a Bangalore vendor\", \"an employment agreement for a senior engineer\", or \"a legal notice for a bounced cheque\"), and I'll match it to a template and draft it for your matter.";

async function systemPrompt(tenantDb: PrismaClient, userId: string): Promise<string> {
  const catalog = await listTemplates(tenantDb, userId);
  const lines = catalog
    .map((t) => `- id=${t.id} | ${t.title} [${t.category}/${t.kind}] — ${t.description}`)
    .join("\n");
  return `You are Viki, an advanced, friendly legal/CA drafting assistant for an Indian law/CA firm, working inside a document editor. You are conversational and helpful, like a sharp junior associate.

Your job in this chat: understand what document the user needs, then produce it.
1. If their request is vague, ask a FEW focused clarifying questions at a time (parties, jurisdiction/seat, key commercial terms, dates) — never a giant form, and never more than 3 questions in one turn.
2. Match the need to the AVAILABLE TEMPLATES below. If a good template exists, tell the user which one you'll use. If none fit, you may draft from scratch.
3. Do NOT invent facts, names, figures, or dates. If something required is missing, either ask, or draft with a clearly marked [TO CONFIRM: ...] blank.
4. Use the current Indian statutory framework (Companies Act 2013; CGST/IGST 2017; Income-tax Act 1961; Arbitration and Conciliation Act 1996; Bharatiya Nyaya Sanhita/Nagarik Suraksha Sanhita/Sakshya Adhiniyam 2023 — never the repealed IPC/CrPC/Evidence Act).
5. When you have ENOUGH to draft, call use_template (preferred, when a template fits) or draft_from_scratch. Pass a thorough "brief" summarising everything gathered in the conversation so the drafter can personalise the document. After the tool runs, briefly confirm to the user what you produced and what they should review.

Remember: everything you produce is a DRAFT that a human lawyer reviews. Be precise, ask when unsure, keep the tone warm and efficient.

AVAILABLE TEMPLATES:
${lines || "(no templates available)"}`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "use_template",
    description: "Generate the document from an existing template, personalised to the matter. Use when a template fits the need.",
    input_schema: {
      type: "object",
      properties: {
        templateId: { type: "string", description: "id of the chosen template from AVAILABLE TEMPLATES" },
        documentTitle: { type: "string", description: "A specific title for this document/matter." },
        brief: { type: "string", description: "A thorough brief of everything gathered in the conversation, for personalisation." },
      },
      required: ["templateId", "documentTitle", "brief"],
    },
  },
  {
    name: "draft_from_scratch",
    description: "Draft a full document from scratch when no template fits.",
    input_schema: {
      type: "object",
      properties: {
        documentTitle: { type: "string" },
        instruction: { type: "string", description: "A thorough description of the document to draft, incorporating everything gathered." },
      },
      required: ["documentTitle", "instruction"],
    },
  },
];

/** Run one Viki turn in an intake session, streaming to SSE subscribers. */
export async function runIntakeTurn(session: IntakeSession): Promise<void> {
  const { id, owner, tenantDb, organizationId } = session;
  if (session.busy) return;
  session.busy = true;
  try {
    const system = await systemPrompt(tenantDb, owner.id);

    for (let iter = 0; iter < MAX_TOOL_ITERS; iter++) {
      emitIntake(id, { type: "state", state: iter === 0 ? "thinking" : "drafting" });

      let assistantText = "";
      const apiKey = await resolveAnthropicApiKey(organizationId);
      const final = await withLLMSlot(async () => {
        const stream = new Anthropic({ apiKey }).messages.stream({
          model: MODEL,
          max_tokens: 4096,
          system,
          tools: TOOLS,
          messages: session.history,
        });
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            assistantText += ev.delta.text;
            emitIntake(id, { type: "assistant_delta", text: ev.delta.text });
          }
        }
        return await stream.finalMessage();
      });
      await recordUsage({ tenantDb, organizationId, kind: "intake", model: MODEL, usage: final.usage, userId: owner.id });
      session.history.push({ role: "assistant", content: final.content });

      const toolUses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

      if (toolUses.length === 0) {
        // Plain conversational turn — asking a question or wrapping up.
        emitIntake(id, { type: "assistant_message", text: assistantText });
        emitIntake(id, { type: "state", state: "awaiting_user" });
        return;
      }

      // Execute tools, feed results back, loop so Viki can confirm.
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        emitIntake(id, { type: "state", state: "drafting" });
        try {
          const result = await executeTool(session, tu);
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
        } catch (err) {
          toolResults.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: (err as Error).message });
          emitIntake(id, { type: "error", message: (err as Error).message });
        }
      }
      session.history.push({ role: "user", content: toolResults });
      // loop continues: Viki produces a confirming message next iteration
    }

    emitIntake(id, { type: "state", state: "awaiting_user" });
  } catch (err) {
    emitIntake(id, { type: "error", message: (err as Error).message });
    emitIntake(id, { type: "state", state: "awaiting_user" });
  } finally {
    session.busy = false;
  }
}

async function executeTool(session: IntakeSession, tu: Anthropic.ToolUseBlock): Promise<string> {
  const { owner, tenantDb, organizationId } = session;
  const ctx = { tenantDb, organizationId, userId: owner.id };

  if (tu.name === "use_template") {
    const input = tu.input as { templateId: string; documentTitle: string; brief: string };
    const template = await getTemplate(tenantDb, input.templateId, owner.id);
    if (!template) return `Template ${input.templateId} not found. Suggest another or draft from scratch.`;
    emitIntake(session.id, {
      type: "template_matches",
      templates: [{ id: template.id, title: template.title, description: template.description }] as IntakeTemplateMatch[],
    });
    const personalized = await personalizeDocument(ctx, template, input.brief);
    const documentId = await generateDocumentFromHtml(
      tenantDb,
      personalized.bodyHtml,
      input.documentTitle,
      template.kind,
      template.id,
      owner,
      personalized.personalizationNotes,
    );
    emitIntake(session.id, {
      type: "document_ready",
      documentId,
      title: input.documentTitle,
      personalizationNotes: personalized.personalizationNotes,
      unresolved: personalized.unresolved,
    });
    return `Document created (id=${documentId}) from template "${template.title}". Personalisation notes: ${personalized.personalizationNotes.join("; ") || "none"}. Unresolved: ${personalized.unresolved.join("; ") || "none"}.`;
  }

  if (tu.name === "draft_from_scratch") {
    const input = tu.input as { documentTitle: string; instruction: string };
    const drafted = await draftDocumentFromScratch(ctx, input.instruction);
    const documentId = await generateDocumentFromHtml(
      tenantDb,
      drafted.bodyHtml,
      input.documentTitle,
      "contract",
      null,
      owner,
      drafted.personalizationNotes,
    );
    emitIntake(session.id, {
      type: "document_ready",
      documentId,
      title: input.documentTitle,
      personalizationNotes: drafted.personalizationNotes,
      unresolved: drafted.unresolved,
    });
    return `Document drafted from scratch (id=${documentId}). Unresolved: ${drafted.unresolved.join("; ") || "none"}.`;
  }

  return `Unknown tool ${tu.name}`;
}
