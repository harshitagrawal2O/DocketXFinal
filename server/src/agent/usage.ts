import { prisma } from "../db.js";
import type { PrismaClient } from "@prisma/client";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Record per-call LLM token usage for cost metering / billing (§4 AI discipline).
 * Best-effort: metering must never break the primary flow, and it never stores
 * any prompt or document content — only counts and the call kind.
 *
 * ALSO deducts the org's credit balance (Organization.creditBalanceTokens is
 * control-plane, hence the separate `prisma` update below rather than going
 * through tenantDb) — every LLM call funnels through here, so this is the one
 * place credit metering needs to live.
 */
export type UsageKind = "agent_run" | "template_analyze" | "template_draft" | "personalize" | "intake";

export async function recordUsage(params: {
  /** Tenant-plane client for THIS call's organization — UsageEvent lives there. */
  tenantDb: PrismaClient;
  /** Control-plane Organization id to deduct credits from. Omit only for pre-org-assignment calls (e.g. intake before signup). */
  organizationId?: string | null;
  kind: UsageKind;
  model: string;
  usage: Anthropic.Usage | { input_tokens?: number; output_tokens?: number } | undefined | null;
  userId?: string | null;
  documentId?: string | null;
}): Promise<void> {
  const inputTokens = params.usage?.input_tokens ?? 0;
  const outputTokens = params.usage?.output_tokens ?? 0;

  try {
    await params.tenantDb.usageEvent.create({
      data: {
        kind: params.kind,
        model: params.model,
        inputTokens,
        outputTokens,
        userId: params.userId ?? null,
        documentId: params.documentId ?? null,
      },
    });
  } catch (err) {
    // Never let metering failures affect the request.
    console.warn("[usage] failed to record:", (err as Error).message);
  }

  if (params.organizationId) {
    try {
      await prisma.organization.update({
        where: { id: params.organizationId },
        data: { creditBalanceTokens: { decrement: inputTokens + outputTokens } },
      });
    } catch (err) {
      console.warn("[usage] failed to deduct credits:", (err as Error).message);
    }
  }
}
