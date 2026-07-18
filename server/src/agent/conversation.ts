import type Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@prisma/client";

/**
 * Persistent conversation memory (per document): distinct from ActiveRun's
 * in-memory `history`, which only threads turns WITHIN one still-open run
 * (e.g. resuming after a clarifying question). This table is what lets a
 * brand-new run — started minutes or days later — still know what was
 * already discussed. Content is always a plain-text instruction or a
 * distilled summary, never a raw provider tool-call payload — those are
 * provider-specific and reconstructing them across a fresh run isn't safe
 * (mismatched tool_use_ids, stale document state).
 */

// Bounds context/cost: only the most recent exchanges carry forward, not the
// entire history of a long-lived document.
const MAX_TURNS_LOADED = 20;

export async function loadRecentTurns(tenantDb: PrismaClient, documentId: string): Promise<Anthropic.MessageParam[]> {
  const rows = await tenantDb.agentTurn.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    take: MAX_TURNS_LOADED,
  });
  return rows.reverse().map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

export async function recordTurn(
  tenantDb: PrismaClient,
  documentId: string,
  agentRunId: string | null,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  // Best-effort: a failure here must never break the run itself.
  try {
    await tenantDb.agentTurn.create({ data: { documentId, agentRunId, role, content } });
  } catch (err) {
    console.error(`[viki] failed to record conversation turn for ${documentId}:`, (err as Error).message);
  }
}

/** Distill this run's outcome into one plain-text assistant turn for future context. */
export function summarizeAssistantTurn(opts: {
  stagedReasonings: string[];
  blockedReasons: string[];
  clarifyingQuestion?: string;
  interrupted?: boolean;
  errorMessage?: string;
}): string {
  if (opts.clarifyingQuestion) return `Asked a clarifying question: ${opts.clarifyingQuestion}`;
  if (opts.errorMessage) return `Hit an error before finishing: ${opts.errorMessage}`;
  if (opts.interrupted) {
    return opts.stagedReasonings.length > 0
      ? `Stopped before finishing (${opts.stagedReasonings.length} change(s) staged before the stop).`
      : "Stopped before making any changes.";
  }
  const parts: string[] = [];
  if (opts.stagedReasonings.length === 0) {
    parts.push("Made no changes — nothing further was needed, or everything proposed was blocked.");
  } else {
    parts.push(`Staged ${opts.stagedReasonings.length} change(s): ${opts.stagedReasonings.map((r, i) => `(${i + 1}) ${r}`).join(" ")}`);
  }
  if (opts.blockedReasons.length > 0) {
    parts.push(`${opts.blockedReasons.length} change(s) were blocked and dropped: ${opts.blockedReasons.join(" ")}`);
  }
  return parts.join(" ");
}
