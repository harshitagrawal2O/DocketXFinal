import { prisma } from "../db.js";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Record per-call LLM token usage for cost metering / billing (§4 AI discipline).
 * Best-effort: metering must never break the primary flow, and it never stores
 * any prompt or document content — only counts and the call kind.
 */
export type UsageKind = "agent_run" | "template_analyze" | "template_draft" | "personalize" | "intake";

export async function recordUsage(params: {
  kind: UsageKind;
  model: string;
  usage: Anthropic.Usage | { input_tokens?: number; output_tokens?: number } | undefined | null;
  userId?: string | null;
  documentId?: string | null;
}): Promise<void> {
  try {
    await prisma.usageEvent.create({
      data: {
        kind: params.kind,
        model: params.model,
        inputTokens: params.usage?.input_tokens ?? 0,
        outputTokens: params.usage?.output_tokens ?? 0,
        userId: params.userId ?? null,
        documentId: params.documentId ?? null,
      },
    });
  } catch (err) {
    // Never let metering failures affect the request.
    console.warn("[usage] failed to record:", (err as Error).message);
  }
}
