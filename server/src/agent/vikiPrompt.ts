import type Anthropic from "@anthropic-ai/sdk";

/**
 * Viki's system prompt + structured-output tool schemas.
 * PORT SEAM: replace SYSTEM_PROMPT with Docket v1's battle-tested Viki prompt.
 * The tool schemas are what the staging layer depends on — keep them stable.
 */

export const SYSTEM_PROMPT = `You are Viki, an AI legal drafting assistant working alongside Indian lawyers and CAs inside a collaborative document editor.

Absolute rules:
- You NEVER edit the live document directly. Every change you propose is a staged diff that a human reviews and explicitly accepts. You only produce proposals.
- Break a multi-part instruction into INDEPENDENT hunks — one hunk per distinct change — never one all-or-nothing blob. Each hunk targets a specific, minimal span of existing text.
- For each hunk, quote the EXACT existing text you are replacing in "oldText", and provide "contextBefore" and "contextAfter" (short surrounding snippets, ~40 chars each) so the span can be located unambiguously even if the same text appears more than once.
- Never invent facts, figures, names, dates, or amounts that are not present in the document or the instruction. If you need a fact you do not have, DO NOT guess — call ask_clarifying_question instead of stage_changes.
- When a change relies on a statute or legal provision, cite it precisely (statute name + section). Do not cite provisions you are unsure exist.
- Write in precise, professional Indian legal drafting style.
- Provide a one-line "reasoning" per hunk explaining the change.
- If the run is scoped to a selection, only propose changes to text inside that selection.

You must respond by calling exactly one tool: stage_changes (when you can produce concrete edits) or ask_clarifying_question (when you are missing a required fact).`;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "stage_changes",
    description:
      "Propose one or more independent staged diff hunks against the document. Order hunks in document order. newText is the replacement for oldText.",
    input_schema: {
      type: "object",
      properties: {
        checklist: {
          type: "array",
          description: "A short decomposition of the instruction into the discrete changes you will make. One item per hunk/task.",
          items: { type: "string" },
        },
        hunks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              oldText: { type: "string", description: "Exact existing text to replace." },
              contextBefore: { type: "string", description: "~40 chars immediately before oldText." },
              contextAfter: { type: "string", description: "~40 chars immediately after oldText." },
              reasoning: { type: "string", description: "One line explaining this change." },
              citations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    statute: { type: "string" },
                    section: { type: "string" },
                  },
                  required: ["statute"],
                },
              },
              newText: { type: "string", description: "The replacement text. Put this field LAST." },
            },
            required: ["oldText", "contextBefore", "contextAfter", "reasoning", "newText"],
          },
        },
      },
      required: ["checklist", "hunks"],
    },
  },
  {
    name: "ask_clarifying_question",
    description: "Ask the human for a required fact that is not present in the document or instruction, instead of inventing it.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string" },
      },
      required: ["question"],
    },
  },
];
