import { OpenAI } from "openai";
import type { Anthropic } from "@anthropic-ai/sdk";
import { withLLMSlot } from "../../llm/limiter.js";
import type { ProviderTurnResult, RunVikiTurnParams } from "../llmProvider.js";

const MODEL = process.env.VIKI_OPENAI_MODEL ?? "gpt-4o";

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return key;
}

/**
 * Anthropic's message/content-block shapes are this app's internal wire
 * format for conversation history regardless of provider (see
 * llmProvider.ts) — translate to OpenAI's chat.completions message shape on
 * every call. Unlike Gemini, OpenAI correlates a tool result to its call by
 * an explicit id (tool_call_id), the same as Anthropic's tool_use_id, so no
 * name-lookup map is needed here.
 */
function toOpenAIMessages(system: string, messages: Anthropic.MessageParam[]): OpenAI.ChatCompletionMessageParam[] {
  const out: OpenAI.ChatCompletionMessageParam[] = [{ role: "system", content: system }];
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      out.push(msg.role === "assistant" ? { role: "assistant", content: msg.content } : { role: "user", content: msg.content });
      continue;
    }
    if (msg.role === "assistant") {
      const textParts: string[] = [];
      const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];
      for (const block of msg.content) {
        if (block.type === "text") textParts.push(block.text);
        else if (block.type === "tool_use") {
          toolCalls.push({ id: block.id, type: "function", function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) } });
        }
      }
      out.push({
        role: "assistant",
        content: textParts.length > 0 ? textParts.join("\n") : null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
    } else {
      for (const block of msg.content) {
        if (block.type === "tool_result") {
          const text = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
          out.push({ role: "tool", tool_call_id: block.tool_use_id, content: text });
        } else if (block.type === "text") {
          out.push({ role: "user", content: block.text });
        }
      }
    }
  }
  return out;
}

/** web_search_20250305 (Anthropic's server tool) has no Chat Completions equivalent (that's a Responses API feature) — dropped. Untested/no-op: gated behind VIKI_WEB_SEARCH, currently off. */
function toOpenAITools(tools: Anthropic.ToolUnion[]): OpenAI.ChatCompletionTool[] {
  const out: OpenAI.ChatCompletionTool[] = [];
  for (const t of tools) {
    if ("type" in t && t.type === "web_search_20250305") continue;
    const tool = t as Anthropic.Tool;
    out.push({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input_schema as Record<string, unknown> } });
  }
  return out;
}

export async function runOpenAITurn(params: RunVikiTurnParams): Promise<ProviderTurnResult> {
  const client = new OpenAI({ apiKey: apiKey() });
  return withLLMSlot(async () => {
    const toolChoice: OpenAI.ChatCompletionToolChoiceOption =
      params.toolChoice && "type" in params.toolChoice && params.toolChoice.type === "auto" ? "auto" : "required";

    const stream = await client.chat.completions.create(
      {
        model: MODEL,
        max_completion_tokens: params.maxTokens,
        messages: toOpenAIMessages(params.system, params.messages),
        tools: toOpenAITools(params.tools),
        tool_choice: toolChoice,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: params.signal },
    );

    let drafting = false;
    const toolCalls = new Map<number, { id?: string; name?: string; args: string }>();
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      for (const choice of chunk.choices ?? []) {
        for (const tc of choice.delta?.tool_calls ?? []) {
          if (!drafting) {
            drafting = true;
            params.onDraftingStart();
          }
          const index = tc.index ?? 0;
          const current = toolCalls.get(index) ?? { args: "" };
          if (tc.id) current.id = tc.id;
          if (tc.function?.name) current.name = tc.function.name;
          if (tc.function?.arguments) {
            current.args += tc.function.arguments;
            params.onRawJsonDelta(current.args);
          }
          toolCalls.set(index, current);
        }
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }

    const usage = { input_tokens: inputTokens, output_tokens: outputTokens };
    const selected = Array.from(toolCalls.values()).find((tc) => tc.id && tc.name);
    if (!selected?.id || !selected.name) {
      return { toolUse: null, assistantContent: [], usage, modelUsed: MODEL };
    }

    let input: unknown = {};
    try {
      input = selected.args ? JSON.parse(selected.args) : {};
    } catch {
      input = {};
    }
    const toolUse: Anthropic.ToolUseBlock = { type: "tool_use", id: selected.id, name: selected.name, input };
    return { toolUse, assistantContent: [toolUse], usage, modelUsed: MODEL };
  });
}
