import { Anthropic } from "@anthropic-ai/sdk";
import { withLLMSlot } from "../../llm/limiter.js";
import { resolveAnthropicApiKey } from "../../llm/orgApiKey.js";
import type { ProviderTurnResult, RunVikiTurnParams } from "../llmProvider.js";

const MODEL = process.env.VIKI_MODEL ?? "claude-opus-4-8";

export async function runAnthropicTurn(params: RunVikiTurnParams): Promise<ProviderTurnResult> {
  const apiKey = await resolveAnthropicApiKey(params.organizationId);
  return withLLMSlot(async () => {
    const stream = new Anthropic({ apiKey }).messages.stream(
      {
        model: MODEL,
        max_tokens: params.maxTokens,
        system: params.system,
        tools: params.tools,
        tool_choice: params.toolChoice,
        messages: params.messages,
      },
      { signal: params.signal },
    );

    // Reset per content block, not per stream: a turn that used the
    // server-side web_search tool has an earlier server_tool_use block
    // streaming its own JSON input ahead of the model's real tool_use call —
    // without resetting, that block's text would prefix-concatenate onto the
    // real tool call's JSON and corrupt the caller's checklist/hunk parsing.
    let raw = "";
    let drafting = false;
    for await (const ev of stream) {
      if (ev.type === "content_block_start") {
        raw = "";
        if (ev.content_block.type === "server_tool_use") params.onServerToolUse?.();
      }
      if (ev.type === "content_block_delta" && ev.delta.type === "input_json_delta") {
        if (!drafting) {
          drafting = true;
          params.onDraftingStart();
        }
        raw += ev.delta.partial_json;
        params.onRawJsonDelta(raw);
      }
    }

    const finalMsg = await stream.finalMessage();
    const toolUse = finalMsg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use") ?? null;
    return {
      toolUse,
      assistantContent: finalMsg.content,
      usage: { input_tokens: finalMsg.usage.input_tokens, output_tokens: finalMsg.usage.output_tokens },
      modelUsed: MODEL,
    };
  });
}
