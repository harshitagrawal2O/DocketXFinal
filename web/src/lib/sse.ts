import type { AgentSSEEvent, IntakeSSEEvent } from "@docket/shared";
import { API_URL, devHeaders } from "./api";

/**
 * Streams an agent run's SSE events using fetch + ReadableStream (not native
 * EventSource) so we can send credentials/dev headers and keep parsing under
 * our control. The endpoint is GET; we parse `data:` lines into AgentSSEEvent.
 *
 * Invariant #2: the caller renders the `intent` event immediately — there is
 * no buffering delay before the first event reaches the UI.
 */
export async function streamAgentRun(
  runId: string,
  handlers: {
    onEvent: (event: AgentSSEEvent) => void;
    onError?: (err: unknown) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/agent-runs/${runId}/stream`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "text/event-stream",
        ...devHeaders(),
      },
      signal: handlers.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Stream failed: ${res.status} ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        emitFrame(frame, handlers.onEvent);
      }
    }
    // Flush any trailing frame.
    if (buffer.trim().length > 0) emitFrame(buffer, handlers.onEvent);
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") return;
    handlers.onError?.(err);
  }
}

/**
 * Streams a chat-intake session's SSE events. Same fetch-based parsing as
 * `streamAgentRun` (GET endpoint, credentials + dev headers, `data:` frames)
 * but typed to `IntakeSSEEvent`. The very first frames (greeting / initial
 * state) reach the UI with no buffering delay — see invariant #2.
 */
export async function streamIntake(
  sessionId: string,
  handlers: {
    onEvent: (event: IntakeSSEEvent) => void;
    onError?: (err: unknown) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/intake/${sessionId}/stream`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "text/event-stream",
        ...devHeaders(),
      },
      signal: handlers.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Stream failed: ${res.status} ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        emitFrame(frame, handlers.onEvent);
      }
    }
    if (buffer.trim().length > 0) emitFrame(buffer, handlers.onEvent);
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") return;
    handlers.onError?.(err);
  }
}

function emitFrame<T>(frame: string, onEvent: (e: T) => void): void {
  const dataLines = frame
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).replace(/^ /, ""));
  if (dataLines.length === 0) return;
  const payload = dataLines.join("\n");
  if (payload === "[DONE]") return;
  try {
    const parsed = JSON.parse(payload) as T;
    onEvent(parsed);
  } catch {
    // Ignore keep-alive comments / malformed frames rather than crash the run.
  }
}
