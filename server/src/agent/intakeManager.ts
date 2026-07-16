import type Anthropic from "@anthropic-ai/sdk";
import type { IntakeSSEEvent } from "@docket/shared";

/** In-memory intake chat sessions (swap for Redis/DB when scaling horizontally). */
export interface IntakeSession {
  id: string;
  userId: string;
  userName: string;
  history: Anthropic.MessageParam[];
  subscribers: Set<(e: IntakeSSEEvent) => void>;
  buffer: IntakeSSEEvent[];
  busy: boolean;
  createdAt: number;
}

const sessions = new Map<string, IntakeSession>();

export function createSession(id: string, userId: string, userName: string): IntakeSession {
  const s: IntakeSession = {
    id,
    userId,
    userName,
    history: [],
    subscribers: new Set(),
    buffer: [],
    busy: false,
    createdAt: Date.now(),
  };
  sessions.set(id, s);
  return s;
}

export function getSession(id: string): IntakeSession | undefined {
  return sessions.get(id);
}

export function emitIntake(id: string, event: IntakeSSEEvent): void {
  const s = sessions.get(id);
  if (!s) return;
  if (s.subscribers.size === 0) s.buffer.push(event);
  else s.subscribers.forEach((fn) => fn(event));
}

export function subscribeIntake(id: string, fn: (e: IntakeSSEEvent) => void): () => void {
  const s = sessions.get(id);
  if (!s) return () => {};
  s.buffer.forEach(fn);
  s.buffer = [];
  s.subscribers.add(fn);
  return () => s.subscribers.delete(fn);
}

/** Drop sessions idle for over an hour (best-effort housekeeping). */
export function reapIdleSessions(now: number): void {
  for (const [id, s] of sessions) {
    if (now - s.createdAt > 60 * 60 * 1000 && s.subscribers.size === 0) sessions.delete(id);
  }
}
