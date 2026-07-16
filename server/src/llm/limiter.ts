/**
 * Bounded concurrency for LLM calls (§4 cost/rate discipline). Protects the
 * Anthropic rate limit and server memory when many users/jobs run at once.
 * Concurrency is env-tunable via LLM_CONCURRENCY (default 4).
 */
const MAX = Math.max(1, Number(process.env.LLM_CONCURRENCY ?? 4));

let active = 0;
const waiters: (() => void)[] = [];

function acquire(): Promise<void> {
  if (active < MAX) {
    active++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
}

function release(): void {
  active--;
  const next = waiters.shift();
  if (next) {
    active++;
    next();
  }
}

/** Run an LLM call within a concurrency slot. */
export async function withLLMSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

export function llmQueueDepth(): { active: number; waiting: number; max: number } {
  return { active, waiting: waiters.length, max: MAX };
}
