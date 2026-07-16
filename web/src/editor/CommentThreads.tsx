import { useState } from "react";
import { useComments } from "./CommentsContext";

function scrollToThread(threadId: string): void {
  const el = document.querySelector<HTMLElement>(
    `.ProseMirror span[data-thread-id="${threadId.replace(/["\\]/g, "\\$&")}"]`,
  );
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Small local formatter — avoids pulling in a date library for one line of UI. */
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export function CommentThreads() {
  const { threads, reply, resolve } = useComments();
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState(false);

  const visible = threads.filter((t) => showResolved || !t.resolved);

  const submitReply = (threadId: string) => {
    const text = (replyText[threadId] ?? "").trim();
    if (!text) return;
    reply(threadId, text);
    setReplyText((r) => ({ ...r, [threadId]: "" }));
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 px-1 text-label-sm font-label-md text-on-surface-variant">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(e) => setShowResolved(e.target.checked)}
          className="h-4 w-4 rounded border-outline-variant text-secondary focus:ring-secondary"
        />
        Show resolved
      </label>

      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-outline-variant p-stack-md text-center">
          <p className="text-body-md text-on-surface-variant">
            No comments{showResolved ? "" : " open"}.
          </p>
          <p className="mt-1 text-label-sm text-on-surface-variant/70">
            Select text in the document and choose Comment to start a thread.
          </p>
        </div>
      )}

      {visible.map((t) => {
        const [root, ...replies] = t.entries;
        return (
          <div
            key={t.id}
            className={`rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-stack-md ink-shadow transition-all duration-300 ${
              t.resolved ? "opacity-40 grayscale hover:opacity-100 hover:grayscale-0" : ""
            }`}
          >
            <div className="mb-stack-sm flex items-start justify-between gap-2">
              <div className="flex items-center gap-stack-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-secondary-fixed text-[11px] font-bold text-secondary">
                  {root ? initials(root.authorName) : "?"}
                </span>
                <div>
                  <h4 className="text-label-md font-label-md leading-none text-primary">
                    {root?.authorName ?? "Unknown"}
                  </h4>
                  <p className="text-[10px] font-medium text-on-surface-variant">
                    {formatRelativeTime(t.createdAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => resolve(t.id, !t.resolved)}
                className="shrink-0 whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-secondary hover:underline"
              >
                {t.resolved ? "Reopen" : "Resolve"}
              </button>
            </div>

            <blockquote
              onClick={() => scrollToThread(t.id)}
              title="Jump to this text in the document"
              className="mb-stack-md cursor-pointer border-l-4 border-secondary bg-surface-container-low p-3 text-sm italic text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              “{t.quote}”
            </blockquote>

            {root && <p className="mb-stack-md text-body-md text-on-surface">{root.body}</p>}

            {replies.map((e) => (
              <div
                key={e.id}
                className="mb-stack-sm flex items-start gap-stack-sm border-t border-outline-variant/30 pt-stack-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-highest text-[10px] font-bold text-on-surface-variant">
                  {initials(e.authorName)}
                </span>
                <div>
                  <p className="text-label-sm font-label-md text-primary">{e.authorName}</p>
                  <p className="text-body-md text-on-surface">{e.body}</p>
                </div>
              </div>
            ))}

            <div className="mt-stack-sm border-t border-outline-variant/30 pt-stack-sm">
              <div className="mb-stack-sm flex items-center gap-stack-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-highest text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">person</span>
                </span>
                <div className="flex-1 rounded bg-surface-container-low p-2">
                  <input
                    placeholder={root ? `Reply to ${root.authorName}…` : "Reply…"}
                    value={replyText[t.id] ?? ""}
                    onChange={(ev) => setReplyText((r) => ({ ...r, [t.id]: ev.target.value }))}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") submitReply(t.id);
                    }}
                    className="w-full border-none bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-0"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => submitReply(t.id)}
                  className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/60 transition-colors hover:text-primary"
                >
                  Post Reply
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
