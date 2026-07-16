import { useEffect, useRef, useState } from "react";
import type {
  IntakeSSEEvent,
  IntakeState,
  IntakeTemplateMatch,
} from "@docket/shared";
import { intakeApi, ApiError } from "@/lib/api";
import { streamIntake } from "@/lib/sse";
import { useSession } from "@/session/SessionContext";

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

/** "Priya Sharma" -> "PS"; single-word names fall back to their first two letters. */
function initialsOf(name: string | undefined | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] ?? "" : "";
  const initials = last ? first.charAt(0) + last.charAt(0) : first.slice(0, 2);
  return initials.toUpperCase() || "?";
}

function VikiAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-brass to-secondary font-serif text-lg italic text-white shadow-sm">
      V
    </div>
  );
}

function UserAvatar({ name }: { name: string | undefined }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary-container text-xs font-label-md text-white">
      {initialsOf(name)}
    </div>
  );
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
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <button
          className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-primary"
          onClick={onBack}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to templates
        </button>
        <div className="rounded border border-error/30 bg-error-container/20 px-4 py-3 text-on-error-container">
          {startError}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col">
      <header className="border-b border-outline-variant/30 pb-4">
        <button
          className="mb-2 inline-flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-primary"
          onClick={onBack}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to templates
        </button>
        <h2 className="font-headline-md text-headline-md italic text-primary">Draft with Viki</h2>
        <p className="mt-1 text-label-sm uppercase tracking-wider text-outline">
          Tell Viki what you need — she matches a template and drafts it for you.
        </p>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto py-6 no-scrollbar" ref={scrollRef}>
        {bubbles.map((b) => (
          <MessageRow key={b.id} bubble={b} onOpenDocument={onOpenDocument} />
        ))}
      </div>

      <div className="border-t border-outline-variant/30 pt-4">
        <div
          className={`mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-label-sm ${
            busy
              ? "bg-secondary-container text-on-secondary-container"
              : "bg-surface-container-high text-on-surface-variant"
          }`}
          role="status"
          aria-live="polite"
        >
          {busy && (
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
          )}
          {STATE_LABEL[state]}
        </div>

        <div className="flex items-end gap-3 rounded-lg border border-outline-variant bg-white p-2 ink-shadow">
          <textarea
            ref={inputRef}
            className="flex-1 resize-none bg-transparent p-2 text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none"
            rows={1}
            placeholder={busy ? "Viki is working…" : "Describe the document you need…"}
            value={input}
            disabled={busy || !sessionId}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Message Viki"
          />
          <button
            className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-label-md font-bold text-on-primary transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void send()}
            disabled={busy || !sessionId || input.trim() === ""}
          >
            Send
            <span className="material-symbols-outlined text-sm">send</span>
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] uppercase tracking-tighter text-outline-variant">
          Enter to send · Shift+Enter for a new line
        </p>
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
  const { user } = useSession();

  if (bubble.role === "user") {
    return (
      <div className="ml-auto flex max-w-[85%] flex-row-reverse items-start gap-3">
        <UserAvatar name={user?.name} />
        <div className="rounded-lg bg-primary p-4 text-on-primary ink-shadow">
          <p className="text-body-md">{bubble.text}</p>
        </div>
      </div>
    );
  }

  if (bubble.role === "assistant") {
    return (
      <div className="flex max-w-[85%] items-start gap-3">
        <VikiAvatar />
        <div className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-4 ink-shadow">
          <p className="whitespace-pre-wrap text-body-md leading-relaxed text-on-surface">
            {bubble.text}
            {bubble.streaming && (
              <span
                className="ml-0.5 inline-block h-4 w-0 border-l-2 border-brass align-middle cursor-blink"
                aria-hidden="true"
              />
            )}
          </p>
        </div>
      </div>
    );
  }

  if (bubble.role === "error") {
    return (
      <div className="flex max-w-[85%] items-start gap-3">
        <VikiAvatar />
        <div className="rounded-lg border border-error/30 bg-error-container/20 p-4 text-on-error-container">
          ⚠ {bubble.text}
        </div>
      </div>
    );
  }

  if (bubble.role === "matches") {
    if (bubble.templates.length === 0) return null;
    return (
      <div className="flex max-w-[85%] flex-wrap gap-2 pl-11">
        {bubble.templates.map((t) => (
          <span
            key={t.id}
            className="rounded-full border border-outline-variant bg-white px-3 py-1 text-label-sm text-secondary"
            title={t.description}
          >
            Using: {t.title}
          </span>
        ))}
      </div>
    );
  }

  // document_ready success card.
  return (
    <div className="flex max-w-[85%] items-start gap-3">
      <VikiAvatar />
      <div className="flex-1 overflow-hidden rounded-lg border-2 border-secondary bg-white ink-shadow">
        <div className="flex items-center gap-2 bg-secondary p-3 text-on-secondary">
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <span className="text-label-md uppercase tracking-wider">Document Ready</span>
        </div>
        <div className="space-y-4 p-5">
          <h3 className="font-headline-md text-headline-md text-primary">{bubble.title}</h3>

          {bubble.personalizationNotes.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-outline">
                Viki tailored:
              </p>
              <ul className="space-y-2">
                {bubble.personalizationNotes.map((n, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined mt-0.5 text-[18px] text-secondary">
                      verified_user
                    </span>
                    <span className="text-body-md text-on-surface-variant">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bubble.unresolved.length > 0 && (
            <div className="space-y-1.5 rounded border border-error/30 bg-error-container/20 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-on-error-container">
                ⚠ Confirm these:
              </p>
              <ul className="space-y-1 pl-1">
                {bubble.unresolved.map((u, i) => (
                  <li key={i} className="text-body-md text-on-error-container">
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            className="flex w-full items-center justify-center gap-2 rounded bg-secondary py-3 text-label-md font-bold uppercase tracking-widest text-on-secondary transition-all hover:bg-secondary/90 active:scale-[0.98]"
            onClick={() => onOpenDocument(bubble.documentId)}
          >
            Open document <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
