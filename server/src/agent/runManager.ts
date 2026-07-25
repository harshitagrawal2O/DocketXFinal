import type { PrismaClient } from "@prisma/client";
import type { AgentSSEEvent } from "@docket/shared";

/**
 * Tracks in-flight agent runs so we can (a) stream SSE to the client that
 * subscribes, (b) support Stop/interrupt, and (c) resume a run after a
 * clarifying question is answered.
 */

export interface ActiveRun {
  runId: string;
  documentId: string;
  userId: string;
  userName: string;
  /** This run's organization's own database (tenant-plane data — Document, DiffProposal, AuditEvent, AgentTurn, ...). */
  tenantDb: PrismaClient;
  /** Control-plane Organization id — used to deduct credits as usage accrues. */
  organizationId: string;
  abort: AbortController;
  /** SSE subscribers for this run. */
  subscribers: Set<(e: AgentSSEEvent) => void>;
  /** Buffered events emitted before the client subscribed. */
  buffer: AgentSSEEvent[];
  interrupted: boolean;
  /** Prior turns for a resumed (post-clarification) run. */
  history: { role: "user" | "assistant"; content: string }[];
  instruction: string;
  scope: "document" | "selection";
  selection?: { start: string; end: string };
}

const runs = new Map<string, ActiveRun>();

export function createRun(init: Omit<ActiveRun, "subscribers" | "buffer" | "interrupted" | "abort"> & { abort?: AbortController }): ActiveRun {
  const run: ActiveRun = {
    ...init,
    abort: init.abort ?? new AbortController(),
    subscribers: new Set(),
    buffer: [],
    interrupted: false,
  };
  runs.set(run.runId, run);
  return run;
}

export function getRun(runId: string): ActiveRun | undefined {
  return runs.get(runId);
}

export function emit(runId: string, event: AgentSSEEvent): void {
  const run = runs.get(runId);
  if (!run) return;
  if (run.subscribers.size === 0) run.buffer.push(event);
  else run.subscribers.forEach((fn) => fn(event));
}

export function subscribe(runId: string, fn: (e: AgentSSEEvent) => void): () => void {
  const run = runs.get(runId);
  if (!run) return () => {};
  // Flush any buffered events first (client subscribed slightly after start).
  run.buffer.forEach(fn);
  run.buffer = [];
  run.subscribers.add(fn);
  return () => run.subscribers.delete(fn);
}

export function stopRun(runId: string): boolean {
  const run = runs.get(runId);
  if (!run) return false;
  run.interrupted = true;
  run.abort.abort();
  return true;
}

/** Terminal run: keep long enough for late/retried SSE subscribers to drain. */
const DRAIN_TTL_MS = 2 * 60 * 1000;
/**
 * A run paused on a clarifying question needs to survive until a HUMAN types
 * an answer — seconds to several minutes, not milliseconds. Using the short
 * drain TTL here was a real bug: the run (and its history, needed to resume)
 * was deleted ~5s after the question was asked, so any answer submitted
 * after that 404'd with "Run not found or expired".
 */
const AWAITING_ANSWER_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function endRun(runId: string, opts: { awaitingAnswer?: boolean } = {}): void {
  const run = runs.get(runId);
  if (!run) return;
  const ttl = opts.awaitingAnswer ? AWAITING_ANSWER_TTL_MS : DRAIN_TTL_MS;
  setTimeout(() => runs.delete(runId), ttl);
}
