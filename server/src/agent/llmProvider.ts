import type Anthropic from "@anthropic-ai/sdk";
import { runAnthropicTurn } from "./providers/anthropic.js";
import { runGeminiTurn } from "./providers/gemini.js";
import { runOpenAITurn } from "./providers/openai.js";

export interface ProviderUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ProviderTurnResult {
  toolUse: Anthropic.ToolUseBlock | null;
  /** Opaque — fed back verbatim as the assistant turn when continuing this run. */
  assistantContent: Anthropic.MessageParam["content"];
  usage: ProviderUsage;
  /** The model actually used — each provider resolves its own (VIKI_MODEL vs VIKI_GEMINI_MODEL); callers report this to recordUsage instead of guessing. */
  modelUsed: string;
}

export interface RunVikiTurnParams {
  /** One organization, one Anthropic key (see llm/orgApiKey.ts) — omit to use the platform key. Gemini is currently platform-key-only (GEMINI_API_KEY). */
  organizationId?: string | null;
  system: string;
  tools: Anthropic.ToolUnion[];
  toolChoice: Anthropic.MessageCreateParamsStreaming["tool_choice"];
  /**
   * Anthropic's message/content-block shapes are this app's internal wire
   * format for conversation history, regardless of which provider is
   * active — see providers/gemini.ts for the translation to/from Gemini's
   * own Content/Part shapes. This keeps runner.ts provider-agnostic.
   */
  messages: Anthropic.MessageParam[];
  maxTokens: number;
  signal: AbortSignal;
  /** Cumulative raw JSON text of the content block currently streaming (resets each new block). */
  onRawJsonDelta: (raw: string) => void;
  onDraftingStart: () => void;
  /** Fires when a server-executed web search tool call starts (Anthropic's web_search or Gemini's googleSearch grounding). */
  onServerToolUse?: () => void;
}

/**
 * PROVIDER SEAM: the one function runner.ts calls to talk to an LLM. Picks
 * the active provider from VIKI_PROVIDER ("anthropic", default, "gemini",
 * or "openai") — runner.ts's iteration/tool-round control flow never needs
 * to know which one is actually running.
 */
export async function runVikiTurn(params: RunVikiTurnParams): Promise<ProviderTurnResult> {
  const provider = (process.env.VIKI_PROVIDER ?? "anthropic").trim().toLowerCase();
  if (provider === "gemini") return runGeminiTurn(params);
  if (provider === "openai") return runOpenAITurn(params);
  return runAnthropicTurn(params);
}
