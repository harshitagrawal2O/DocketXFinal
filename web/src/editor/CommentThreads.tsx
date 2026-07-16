import { useState } from "react";
import { useComments } from "./CommentsContext";

function scrollToThread(threadId: string): void {
  const el = document.querySelector<HTMLElement>(
    `.ProseMirror span[data-thread-id="${threadId.replace(/["\\]/g, "\\$&")}"]`,
  );
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function CommentThreads() {
  const { threads, reply, resolve } = useComments();
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState(false);

  const visible = threads.filter((t) => showResolved || !t.resolved);

  return (
    <div className="comment-threads">
      <div className="comment-threads-head">
        <label className="check-inline">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          Show resolved
        </label>
      </div>

      {visible.length === 0 && (
        <div className="empty-state sm">
          <p>No comments{showResolved ? "" : " open"}.</p>
          <p className="muted">Select text in the document and choose Comment to start a thread.</p>
        </div>
      )}

      {visible.map((t) => (
        <div key={t.id} className={`thread-card${t.resolved ? " resolved" : ""}`}>
          <blockquote className="thread-quote" onClick={() => scrollToThread(t.id)}>
            “{t.quote}”
          </blockquote>
          {t.entries.map((e) => (
            <div key={e.id} className="thread-entry">
              <span className="thread-author">{e.authorName}</span>
              <p>{e.body}</p>
            </div>
          ))}
          <div className="thread-actions">
            <input
              placeholder="Reply…"
              value={replyText[t.id] ?? ""}
              onChange={(ev) => setReplyText((r) => ({ ...r, [t.id]: ev.target.value }))}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && (replyText[t.id] ?? "").trim()) {
                  reply(t.id, replyText[t.id] ?? "");
                  setReplyText((r) => ({ ...r, [t.id]: "" }));
                }
              }}
            />
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => resolve(t.id, !t.resolved)}
            >
              {t.resolved ? "Reopen" : "Resolve"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
