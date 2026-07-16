import { useEffect, useRef, useState } from "react";
import type {
  IntakeSSEEvent,
  IntakeState,
  IntakeTemplateMatch,
} from "@docket/shared";
import { intakeApi, ApiError } from "@/lib/api";
import { streamIntake } from "@/lib/sse";

/**
 * "Draft with Viki" — a chat-first way to create a document. Viki greets, asks
 * what's needed, asks clarifying questions conversationally, matches the
 * template library, drafts the personalised document, then hands off to the
 * editor. Sits alongside the form-based template generation.
 */

interface Props {
  onBack: () => void;
  /** Open the freshly-drafted document in the workspace. */
  onOpenDocument: (id: string) => void;
}

type Bubble =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; streaming: boolean }
  | { id: string; role: "error"; text: string }
  | { id: string; role: "matches"; templates: IntakeTemplateMatch[] }
  | {
      id: string;
      role: "document";
      documentId: string;
      title: string;
      personalizationNotes: string[];
      unresolved: string[];
    };

/** The busy states during which the user must wait (input disabled). */
const BUSY_STATES: ReadonlySet<IntakeState> = new Set<IntakeState>([
  "thinking",
  "searching",
  "drafting",
]);

const STATE_LABEL: Record<IntakeState, string> = {
  thinking: "Viki is thinking…",
  searching: "Searching the template library…",
  drafting: "Drafting your document…",
  awaiting_user: "Your turn",
  done: "Done",
};

let bubbleSeq = 0;
function nextId(): string {
  bubbleSeq += 1;
  return `b${bubbleSeq}`;
}

export function IntakeChat({ onBack, onOpenDocument }: Props) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [state, setState] = useState<IntakeState>("thinking");
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // Id of the assistant bubble currently receiving deltas, if any.
  const streamingIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const busy = BUSY_STATES.has(state);

  // --- Start the session + open the stream on mount. ----------------------
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    intakeApi
      .start()
      .then((res) => {
        if (!alive) return;
        setSessionId(res.sessionId);
        setBubbles([
          { id: nextId(), role: "assistant", text: res.greeting, streaming: false },
        ]);
        setState("awaiting_user");
        return streamIntake(res.sessionId, {
          signal: controller.signal,
          onEvent: handleEvent,
          onError: () => {
            if (alive) pushError("Lost the connection to Viki. Please try again.");
          },
        });
      })
      .catch(() => {
        if (alive) setStartError("Could not start a session with Viki.");
      });

    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Autoscroll to newest content. --------------------------------------
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles, state]);

  function pushError(text: string) {
    setBubbles((prev) => [...prev, { id: nextId(), role: "error", text }]);
  }

  function handleEvent(event: IntakeSSEEvent) {
    switch (event.type) {
      case "state": {
        setState(event.state);
        break;
      }
      case "assistant_delta": {
        setBubbles((prev) => {
          const streamingId = streamingIdRef.current;
          if (streamingId) {
            return prev.map((b) =>
              b.id === streamingId && b.role === "assistant"
                ? { ...b, text: b.text + event.text }
                : b,
            );
          }
          const id = nextId();
          streamingIdRef.current = id;
          return [...prev, { id, role: "assistant", text: event.text, streaming: true }];
        });
        break;
      }
      case "assistant_message": {
        setBubbles((prev) => {
          const streamingId = streamingIdRef.current;
          if (streamingId) {
            return prev.map((b) =>
              b.id === streamingId && b.role === "assistant"
                ? { ...b, text: event.text, streaming: false }
                : b,
            );
          }
          return [
            ...prev,
            { id: nextId(), role: "assistant", text: event.text, streaming: false },
          ];
        });
        streamingIdRef.current = null;
        break;
      }
      case "template_matches": {
        setBubbles((prev) => [
          ...prev,
          { id: nextId(), role: "matches", templates: event.templates },
        ]);
        break;
      }
      case "document_ready": {
        setBubbles((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "document",
            documentId: event.documentId,
            title: event.title,
            personalizationNotes: event.personalizationNotes,
            unresolved: event.unresolved,
          },
        ]);
        break;
      }
      case "error": {
        streamingIdRef.current = null;
        pushError(event.message);
        setState("awaiting_user");
        break;
      }
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy || !sessionId) return;

    // Optimistic user bubble.
    setBubbles((prev) => [...prev, { id: nextId(), role: "user", text }]);
    setInput("");
    // Viki takes over — reflect that immediately so the input locks without a
    // silent wait; the server confirms with real state events.
    setState("thinking");

    try {
      await intakeApi.sendMessage(sessionId, text);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        pushError("Viki is still replying — give it a moment before sending again.");
      } else {
        pushError("Couldn't send that message. Please try again.");
        // Re-enable input so the user can retry.
        setState("awaiting_user");
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (startError) {
    return (
      <div className="templates-view">
        <button className="btn btn-sm" onClick={onBack}>
          ← Back to templates
        </button>
        <div className="error-line">{startError}</div>
      </div>
    );
  }

  return (
    <div className="viki-chat">
      <header className="viki-chat-head">
        <button className="btn btn-sm" onClick={onBack}>
          ← Back to templates
        </button>
        <div className="viki-chat-title">
          <span className="viki-avatar" aria-hidden="true">
            ✨
          </span>
          <div>
            <h2>Draft with Viki</h2>
            <p className="muted">
              Tell Viki what you need — she matches a template and drafts it for you.
            </p>
          </div>
        </div>
      </header>

      <div className="viki-messages" ref={scrollRef}>
        {bubbles.map((b) => (
          <MessageRow key={b.id} bubble={b} onOpenDocument={onOpenDocument} />
        ))}
      </div>

      <div className="viki-composer">
        <div
          className={`viki-state-chip viki-state-chip--${state}`}
          role="status"
          aria-live="polite"
        >
          {busy && <span className="viki-dots" aria-hidden="true" />}
          {STATE_LABEL[state]}
        </div>
        <div className="viki-input-row">
          <textarea
            ref={inputRef}
            className="viki-input"
            rows={1}
            placeholder={
              busy ? "Viki is working…" : "Describe the document you need…"
            }
            value={input}
            disabled={busy || !sessionId}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Message Viki"
          />
          <button
            className="btn btn-primary viki-send"
            onClick={() => void send()}
            disabled={busy || !sessionId || input.trim() === ""}
          >
            Send
          </button>
        </div>
        <p className="viki-hint muted">Enter to send · Shift+Enter for a new line</p>
      </div>
    </div>
  );
}

function MessageRow({
  bubble,
  onOpenDocument,
}: {
  bubble: Bubble;
  onOpenDocument: (id: string) => void;
}) {
  if (bubble.role === "user") {
    return (
      <div className="viki-row viki-row--user">
        <div className="viki-bubble viki-bubble--user">{bubble.text}</div>
      </div>
    );
  }

  if (bubble.role === "assistant") {
    return (
      <div className="viki-row viki-row--assistant">
        <div className="viki-bubble viki-bubble--assistant">
          {bubble.text}
          {bubble.streaming && <span className="viki-caret" aria-hidden="true" />}
        </div>
      </div>
    );
  }

  if (bubble.role === "error") {
    return (
      <div className="viki-row viki-row--assistant">
        <div className="viki-bubble viki-bubble--error">⚠ {bubble.text}</div>
      </div>
    );
  }

  if (bubble.role === "matches") {
    if (bubble.templates.length === 0) return null;
    return (
      <div className="viki-row viki-row--assistant">
        <div className="viki-matches">
          {bubble.templates.map((t) => (
            <span key={t.id} className="viki-match-chip" title={t.description}>
              Using: {t.title}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // document_ready success card.
  return (
    <div className="viki-row viki-row--assistant">
      <div className="viki-doc-card">
        <p className="viki-doc-title">✅ Draft ready: {bubble.title}</p>

        {bubble.personalizationNotes.length > 0 && (
          <div className="viki-doc-block">
            <p className="viki-doc-block-title">Viki tailored:</p>
            <ul className="personalization-notes">
              {bubble.personalizationNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {bubble.unresolved.length > 0 && (
          <div className="unresolved-block">
            <p className="unresolved-title">⚠ Confirm these:</p>
            <ul>
              {bubble.unresolved.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          className="btn btn-primary btn-block"
          onClick={() => onOpenDocument(bubble.documentId)}
        >
          Open document →
        </button>
      </div>
    </div>
  );
}
