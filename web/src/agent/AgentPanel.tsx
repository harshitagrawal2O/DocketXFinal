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
    <div
      className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-label-sm font-label-sm text-on-secondary shadow-[0_0_15px_rgba(154,123,79,0.15)]"
      data-state={state}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      <span>{STATE_LABEL[state]}</span>
      <span className="ml-1 flex items-center gap-0.5" aria-hidden>
        {STATE_ORDER.map((s, i) => (
          <span
            key={s}
            className={`h-1 w-1 rounded-full ${i <= idx ? "bg-white" : "bg-white/30"}`}
          />
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
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-surface-dim p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-outline-variant">lock</span>
        <p className="text-body-md text-on-surface">You have view-only access.</p>
        <p className="text-label-sm text-on-surface-variant">
          Ask an editor or the owner to run Viki on this document.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface-dim">
      <div className="space-y-3 border-b border-outline-variant bg-surface-container-high/50 p-6">
        <textarea
          className="w-full resize-none rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-body-md text-on-surface placeholder:text-outline/70 focus:border-brass focus:outline-none disabled:opacity-60"
          placeholder="Tell Viki what to draft or revise — e.g. “Tighten the indemnity clause and cap liability at fees paid.”"
          value={agent.draft.instruction}
          onChange={(e) => agent.setDraft({ ...agent.draft, instruction: e.target.value })}
          rows={3}
          disabled={agent.running}
        />

        <div className="flex items-center justify-between gap-3">
          <div
            className="flex rounded-full border border-outline-variant bg-surface-container-high p-1"
            role="tablist"
            aria-label="Run scope"
          >
            <button
              role="tab"
              aria-selected={agent.draft.scope === "document"}
              className={`rounded-full px-3 py-1 text-label-sm font-label-md transition-all ${
                agent.draft.scope === "document"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-highest"
              }`}
              onClick={() => agent.setDraft({ ...agent.draft, scope: "document" })}
              disabled={agent.running}
            >
              Whole document
            </button>
            <button
              role="tab"
              aria-selected={agent.draft.scope === "selection"}
              className={`rounded-full px-3 py-1 text-label-sm font-label-md transition-all ${
                agent.draft.scope === "selection"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-highest"
              }`}
              onClick={() => agent.setDraft({ ...agent.draft, scope: "selection" })}
              disabled={agent.running}
              title={hasSelection ? "Run on the current selection" : "Select text first"}
            >
              Selection
            </button>
          </div>

          {agent.running ? (
            <button
              className="flex items-center gap-2 rounded border border-error/20 bg-error-container px-3 py-1.5 text-on-error-container transition-all hover:bg-error hover:text-on-error"
              onClick={() => void agent.stop()}
            >
              <span className="material-symbols-outlined text-[16px]">stop_circle</span>
              <span className="text-label-sm font-label-sm font-bold uppercase">Stop</span>
            </button>
          ) : (
            <button
              className="rounded bg-primary px-4 py-1.5 text-label-md font-label-md text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
          <p className="text-label-sm text-on-surface-variant">
            Select text in the document to scope the run.
          </p>
        )}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6 no-scrollbar">
        {/* Invariant #2: the intent line renders before any spinner — this
            block never shows a bare/unlabeled loading indicator. */}
        {(agent.running || agent.intent) && (
          <div className="space-y-4">
            {agent.running && agent.draft.instruction.trim() && (
              <div className="rounded-lg border border-outline/10 bg-primary-container p-4">
                <p className="mb-1 text-[10px] uppercase tracking-wide text-on-primary-container/60">
                  Instruction
                </p>
                <p className="text-body-md font-medium text-on-primary-container">
                  “{agent.draft.instruction.trim()}”
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {agent.runState && <RunStateChip state={agent.runState} />}
              {agent.intent && (
                <span className="text-label-sm italic text-outline">{agent.intent}</span>
              )}
            </div>

            {agent.checklist.length > 0 && (
              <div>
                <h4 className="mb-3 text-label-sm font-label-sm uppercase tracking-tighter text-outline">
                  Sub-tasks status
                </h4>
                <div className="space-y-3">
                  {agent.checklist.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 ${item.done ? "" : "opacity-40"}`}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          item.done ? "border-secondary bg-secondary/10" : "border-outline"
                        }`}
                      >
                        {item.done && (
                          <span className="material-symbols-outlined text-[14px] text-secondary">
                            check
                          </span>
                        )}
                      </div>
                      <span className={`text-body-md ${item.done ? "text-on-surface" : ""}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {agent.blocked.length > 0 && (
          <div>
            <h4 className="mb-3 flex items-center gap-1.5 text-label-sm font-label-sm uppercase tracking-tighter text-error">
              <span className="material-symbols-outlined text-[16px]">block</span>
              Blocked hunks
            </h4>
            <div className="space-y-3">
              {agent.blocked.map((b) => (
                <div key={b.hunkIndex} className="rounded border border-error/30 bg-error-container/20 p-3">
                  <p className="text-label-sm font-label-md text-on-error-container">
                    ⚠ {b.reason}
                  </p>
                  {b.citations.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {b.citations.map((c, i) => (
                        <li key={i} className="text-[11px]">
                          <span className="font-label-md text-on-error-container">{c.label}</span>
                          {c.verificationNote && (
                            <span className="block text-on-error-container/80">
                              {c.verificationNote}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {agent.clarifying && (
          <div className="space-y-2 rounded-lg border-l-4 border-brass bg-surface-container-low p-4">
            <div className="flex items-center gap-2 text-label-sm font-label-md uppercase tracking-wide text-secondary">
              <span className="material-symbols-outlined text-[16px]">help</span>
              Viki needs a fact
            </div>
            <p className="text-body-md text-on-surface">{agent.clarifying}</p>
            <textarea
              className="w-full rounded border border-outline-variant bg-white p-2 text-body-md focus:border-brass focus:outline-none"
              placeholder="Provide the fact or figure…"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              rows={2}
            />
            <button
              className="rounded bg-primary px-3 py-1.5 text-label-sm font-label-md text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!answerText.trim()}
              onClick={async () => {
                await agent.answer(answerText);
                setAnswerText("");
              }}
            >
              Answer &amp; resume
            </button>
          </div>
        )}

        {agent.error && (
          <div className="rounded border border-error/30 bg-error-container/20 p-3 text-label-sm text-on-error-container">
            {agent.error}
          </div>
        )}
      </div>
    </div>
  );
}
