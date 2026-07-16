import { useState } from "react";
import type { Role } from "@docket/shared";
import { can } from "@docket/shared";
import { useAgent, type LiveRunState } from "./AgentContext";
import { useEditorInstance } from "@/editor/EditorContext";

const STATE_LABEL: Record<LiveRunState, string> = {
  thinking: "Thinking",
  drafting: "Drafting",
  self_checking: "Self-checking",
  awaiting_review: "Awaiting review",
};

const STATE_ORDER: LiveRunState[] = ["thinking", "drafting", "self_checking", "awaiting_review"];

function RunStateChip({ state }: { state: LiveRunState }) {
  const idx = STATE_ORDER.indexOf(state);
  return (
    <div className="run-state-chip" data-state={state}>
      <span className="run-state-dot" />
      {STATE_LABEL[state]}
      <span className="run-state-track">
        {STATE_ORDER.map((s, i) => (
          <span key={s} className={`run-state-tick${i <= idx ? " on" : ""}`} />
        ))}
      </span>
    </div>
  );
}

export function AgentPanel({ role }: { role: Role }) {
  const agent = useAgent();
  const { editor } = useEditorInstance();
  const [answerText, setAnswerText] = useState("");

  const canRun = can(role, "run_agent");
  const hasSelection = editor
    ? editor.state.selection.from !== editor.state.selection.to
    : false;

  if (!canRun) {
    return (
      <div className="agent-panel">
        <div className="empty-state sm">
          <p>You have view-only access.</p>
          <p className="muted">Ask an editor or the owner to run Viki on this document.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-panel">
      <div className="agent-composer">
        <textarea
          className="agent-instruction"
          placeholder="Tell Viki what to draft or revise — e.g. “Tighten the indemnity clause and cap liability at fees paid.”"
          value={agent.draft.instruction}
          onChange={(e) => agent.setDraft({ ...agent.draft, instruction: e.target.value })}
          rows={3}
          disabled={agent.running}
        />

        <div className="agent-scope">
          <div className="scope-toggle" role="tablist" aria-label="Run scope">
            <button
              role="tab"
              aria-selected={agent.draft.scope === "document"}
              className={agent.draft.scope === "document" ? "active" : ""}
              onClick={() => agent.setDraft({ ...agent.draft, scope: "document" })}
              disabled={agent.running}
            >
              Whole document
            </button>
            <button
              role="tab"
              aria-selected={agent.draft.scope === "selection"}
              className={agent.draft.scope === "selection" ? "active" : ""}
              onClick={() => agent.setDraft({ ...agent.draft, scope: "selection" })}
              disabled={agent.running}
              title={hasSelection ? "Run on the current selection" : "Select text first"}
            >
              Selection
            </button>
          </div>

          {agent.running ? (
            <button className="btn btn-reject btn-sm" onClick={() => void agent.stop()}>
              Stop
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              disabled={
                !agent.draft.instruction.trim() ||
                (agent.draft.scope === "selection" && !hasSelection)
              }
              onClick={() => void agent.submit()}
            >
              Run Viki
            </button>
          )}
        </div>
        {agent.draft.scope === "selection" && !hasSelection && !agent.running && (
          <p className="muted agent-hint">Select text in the document to scope the run.</p>
        )}
      </div>

      {/* Invariant #2: the intent line renders before any spinner. */}
      {(agent.running || agent.intent) && (
        <div className="agent-live">
          {agent.intent && (
            <div className="agent-intent">
              <span className="agent-intent-badge">Intent</span>
              {agent.intent}
            </div>
          )}
          {agent.runState && <RunStateChip state={agent.runState} />}

          {agent.checklist.length > 0 && (
            <ul className="agent-checklist">
              {agent.checklist.map((item) => (
                <li key={item.id} className={item.done ? "done" : ""}>
                  <span className="check-box">{item.done ? "✓" : ""}</span>
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {agent.blocked.length > 0 && (
        <div className="agent-blocked">
          <h4>Blocked hunks</h4>
          {agent.blocked.map((b) => (
            <div key={b.hunkIndex} className="blocked-card">
              <div className="blocked-reason">⚠ {b.reason}</div>
              {b.citations.length > 0 && (
                <ul className="citation-list">
                  {b.citations.map((c, i) => (
                    <li key={i} className="citation citation--blocked">
                      <span className="citation-label">{c.label}</span>
                      {c.verificationNote && (
                        <span className="citation-note">{c.verificationNote}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {agent.clarifying && (
        <div className="clarify-card">
          <div className="clarify-head">Viki needs a fact</div>
          <p className="clarify-question">{agent.clarifying}</p>
          <textarea
            placeholder="Provide the fact or figure…"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            rows={2}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={!answerText.trim()}
            onClick={async () => {
              await agent.answer(answerText);
              setAnswerText("");
            }}
          >
            Answer & resume
          </button>
        </div>
      )}

      {agent.error && <div className="error-line">{agent.error}</div>}
    </div>
  );
}
