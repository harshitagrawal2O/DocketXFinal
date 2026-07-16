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

export function endRun(runId: string): void {
  // Keep briefly so late subscribers can drain; then drop.
  const run = runs.get(runId);
  if (!run) return;
  setTimeout(() => runs.delete(runId), 5000);
}
