import Anthropic from "@anthropic-ai/sdk";
import { withLLMSlot } from "../llm/limiter.js";

/**
 * PROVIDER SEAM: the one function runner.ts calls to talk to an LLM. Today
 * only Anthropic is implemented; a Gemini adapter with this same signature
 * can be swapped in later (behind a VIKI_PROVIDER env switch) without
 * touching runner.ts's iteration/tool-round control flow.
 */
export interface ProviderTurnResult {
  toolUse: Anthropic.ToolUseBlock | null;
  /** Opaque — fed back verbatim as the assistant turn when continuing this run. */
  assistantContent: Anthropic.MessageParam["content"];
  usage: Anthropic.Usage;
}

export interface RunVikiTurnParams {
  model: string;
  system: string;
  tools: Anthropic.ToolUnion[];
  toolChoice: Anthropic.MessageCreateParamsStreaming["tool_choice"];
  messages: Anthropic.MessageParam[];
  maxTokens: number;
  signal: AbortSignal;
  /** Cumulative raw JSON text of the content block currently streaming (resets each new block). */
  onRawJsonDelta: (raw: string) => void;
  onDraftingStart: () => void;
  /** Fires when Anthropic's server-executed web_search tool starts a call. */
  onServerToolUse?: () => void;
}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

export async function runVikiTurn(params: RunVikiTurnParams): Promise<ProviderTurnResult> {
  return withLLMSlot(async () => {
    const stream = client().messages.stream(
      {
        model: params.model,
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
    return { toolUse, assistantContent: finalMsg.content, usage: finalMsg.usage };
  });
}
