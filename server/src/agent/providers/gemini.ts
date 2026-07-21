import { GoogleGenAI, FunctionCallingConfigMode, type Content, type Part, type Tool as GeminiTool } from "@google/genai";
import type Anthropic from "@anthropic-ai/sdk";
import { withLLMSlot } from "../../llm/limiter.js";
import type { ProviderTurnResult, RunVikiTurnParams } from "../llmProvider.js";

const MODEL = process.env.VIKI_GEMINI_MODEL ?? "gemini-2.5-pro";

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

/**
 * Anthropic's message/content-block shapes are this app's internal wire
 * format for conversation history regardless of provider (see
 * llmProvider.ts) — translate to Gemini's Content/Part shapes on every
 * call. Gemini correlates a function's response to its call by NAME, not
 * by an id the way Anthropic's tool_use_id does, so we track id->name as we
 * walk the history in order (every tool_use is immediately followed, in
 * this app, by exactly one matching tool_result).
 */
function toGeminiContents(messages: Anthropic.MessageParam[]): Content[] {
  const idToName = new Map<string, string>();
  const contents: Content[] = [];
  for (const msg of messages) {
    const parts: Part[] = [];
    if (typeof msg.content === "string") {
      parts.push({ text: msg.content });
    } else {
      for (const block of msg.content) {
        if (block.type === "text") {
          parts.push({ text: block.text });
        } else if (block.type === "tool_use") {
          idToName.set(block.id, block.name);
          parts.push({ functionCall: { name: block.name, args: block.input as Record<string, unknown> } });
        } else if (block.type === "tool_result") {
          const name = idToName.get(block.tool_use_id) ?? "unknown_tool";
          const text =
            typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content);
          parts.push({ functionResponse: { name, response: { result: text } } });
        }
      }
    }
    contents.push({ role: msg.role === "assistant" ? "model" : "user", parts });
  }
  return contents;
}

/** web_search_20250305 (Anthropic's server tool) has no direct Gemini equivalent tool id — mapped to Gemini's own googleSearch grounding tool. Untested combination: gated behind VIKI_WEB_SEARCH, currently off. */
function toGeminiTools(tools: Anthropic.ToolUnion[]): GeminiTool[] {
  const functionDeclarations: { name: string; description?: string; parametersJsonSchema: unknown }[] = [];
  let wantsWebSearch = false;
  for (const t of tools) {
    if ("type" in t && t.type === "web_search_20250305") {
      wantsWebSearch = true;
      continue;
    }
    const tool = t as Anthropic.Tool;
    functionDeclarations.push({ name: tool.name, description: tool.description, parametersJsonSchema: tool.input_schema });
  }
  const geminiTools: GeminiTool[] = [];
  if (functionDeclarations.length > 0) geminiTools.push({ functionDeclarations });
  if (wantsWebSearch) geminiTools.push({ googleSearch: {} });
  return geminiTools;
}

export async function runGeminiTurn(params: RunVikiTurnParams): Promise<ProviderTurnResult> {
  const ai = new GoogleGenAI({ apiKey: apiKey() });
  return withLLMSlot(async () => {
    const mode =
      params.toolChoice && "type" in params.toolChoice && params.toolChoice.type === "auto"
        ? FunctionCallingConfigMode.AUTO
        : FunctionCallingConfigMode.ANY;

    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents: toGeminiContents(params.messages),
      config: {
        systemInstruction: params.system,
        tools: toGeminiTools(params.tools),
        toolConfig: { functionCallingConfig: { mode } },
        maxOutputTokens: params.maxTokens,
        abortSignal: params.signal,
      },
    });

    let drafting = false;
    let sawGrounding = false;
    let lastFunctionCall: { name: string; args: Record<string, unknown> } | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      if (!drafting) {
        drafting = true;
        params.onDraftingStart();
      }
      if (!sawGrounding && chunk.candidates?.[0]?.groundingMetadata) {
        sawGrounding = true;
        params.onServerToolUse?.();
      }
      const fc = chunk.functionCalls?.[0];
      if (fc?.name) {
        lastFunctionCall = { name: fc.name, args: fc.args ?? {} };
        // Gemini does not stream partial function-call arguments the way
        // Anthropic streams input_json_delta token-by-token — the complete
        // call arrives atomically, so this fires once with the full JSON
        // rather than growing incrementally. Checklist/hunk_delta parsing
        // in runner.ts still works correctly either way.
        params.onRawJsonDelta(JSON.stringify(fc.args ?? {}));
      }
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
        outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
      }
    }

    const usage = { input_tokens: inputTokens, output_tokens: outputTokens };
    if (!lastFunctionCall) {
      return { toolUse: null, assistantContent: [], usage, modelUsed: MODEL };
    }

    const toolUse: Anthropic.ToolUseBlock = {
      type: "tool_use",
      id: `gemini_${Math.random().toString(36).slice(2, 12)}`,
      name: lastFunctionCall.name,
      input: lastFunctionCall.args,
    };
    return { toolUse, assistantContent: [toolUse], usage, modelUsed: MODEL };
  });
}
