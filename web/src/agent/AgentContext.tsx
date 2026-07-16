import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AgentRunScope,
  AgentSSEEvent,
  ChecklistItem,
  Citation,
  DiffProposal,
  StartAgentRunRequest,
} from "@docket/shared";
import { agentApi } from "@/lib/api";
import { streamAgentRun } from "@/lib/sse";
import { absoluteToRelPos, getBinding } from "@/lib/anchors";
import { useEditorInstance } from "@/editor/EditorContext";
import { useStaging } from "@/staging/StagingContext";

export type LiveRunState = "thinking" | "drafting" | "self_checking" | "awaiting_review";

export interface BlockedHunk {
  hunkIndex: number;
  reason: string;
  citations: Citation[];
}

export interface AgentDraft {
  instruction: string;
  scope: AgentRunScope;
}

interface AgentState {
  running: boolean;
  runId: string | null;
  intent: string | null;
  runState: LiveRunState | null;
  checklist: ChecklistItem[];
  blocked: BlockedHunk[];
  clarifying: string | null;
  error: string | null;
  draft: AgentDraft;
  setDraft: (d: AgentDraft) => void;
  /** Start a run from the current draft (reads editor selection if scoped). */
  submit: () => Promise<void>;
  /** Answer a clarifying question, resuming the same run context. */
  answer: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  /** Placeholder "re-run on current text" for an outdated proposal. */
  rerun: (proposal: DiffProposal) => void;
}

const Ctx = createContext<AgentState | null>(null);

export function AgentProvider({
  documentId,
  children,
}: {
  documentId: string;
  children: ReactNode;
}) {
  const { editor } = useEditorInstance();
  const { upsertLocal, discardLocal, setActive } = useStaging();

  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [runState, setRunState] = useState<LiveRunState | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [blocked, setBlocked] = useState<BlockedHunk[]>([]);
  const [clarifying, setClarifying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgentDraft>({ instruction: "", scope: "document" });

  const abortRef = useRef<AbortController | null>(null);
  // Accumulated streaming text per proposalId, plus hunk order for skeletons.
  const bufferRef = useRef(new Map<string, string>());
  const orderRef = useRef(0);
  // Anchors to force onto the next selection-scoped run (used by rerun).
  const rerunAnchorsRef = useRef<{ start: string; end: string } | null>(null);

  const resetRunState = useCallback(() => {
    setIntent(null);
    setRunState(null);
    setChecklist([]);
    setBlocked([]);
    setClarifying(null);
    setError(null);
    bufferRef.current.clear();
    orderRef.current = 0;
  }, []);

  const handleEvent = useCallback(
    (evt: AgentSSEEvent, activeRunId: string) => {
      switch (evt.type) {
        case "intent":
          setIntent(evt.text);
          break;
        case "run_state":
          setRunState(evt.state);
          break;
        case "checklist":
          setChecklist(evt.items);
          break;
        case "hunk_delta": {
          const prevText = bufferRef.current.get(evt.proposalId) ?? "";
          const nextText = prevText + evt.delta;
          bufferRef.current.set(evt.proposalId, nextText);
          const skeleton: DiffProposal = {
            id: evt.proposalId,
            documentId,
            agentRunId: activeRunId,
            anchorStart: "",
            anchorEnd: "",
            oldText: "",
            newText: nextText,
            reasoning: "",
            citations: [],
            status: "streaming",
            createdAt: new Date().toISOString(),
            hunkIndex: orderRef.current++,
          };
          upsertLocal(skeleton);
          break;
        }
        case "hunk_complete":
          // Fully anchored proposal; Accept may now enable.
          upsertLocal(evt.proposal);
          bufferRef.current.delete(evt.proposal.id);
          break;
        case "hunk_blocked":
          setBlocked((b) => [
            ...b,
            { hunkIndex: evt.hunkIndex, reason: evt.reason, citations: evt.citations },
          ]);
          // hunk_complete will never arrive for this proposalId — discard its
          // streaming preview so it doesn't sit stuck forever with a dead
          // Accept button. The block reason above is the permanent record.
          discardLocal(evt.proposalId);
          bufferRef.current.delete(evt.proposalId);
          break;
        case "clarifying_question":
          setClarifying(evt.question);
          setRunning(false);
          setRunState("awaiting_review");
          // The server intentionally keeps this connection open in case the
          // run needs to resume, but the client has nothing further to do
          // with it right now — answering opens a brand-new stream via
          // startRequest(). Left open, this connection just idles until some
          // browser/proxy timeout eventually kills it, which streamAgentRun
          // would otherwise (wrongly) report as "the stream was interrupted".
          // Closing it ourselves is a clean, expected abort, not an error.
          abortRef.current?.abort();
          break;
        case "run_complete":
        case "run_interrupted":
          setRunning(false);
          setRunState((s) => (s === "awaiting_review" ? s : "awaiting_review"));
          break;
        case "error":
          setError(evt.message);
          setRunning(false);
          break;
      }
    },
    [documentId, upsertLocal, discardLocal],
  );

  const openStream = useCallback(
    (activeRunId: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      void streamAgentRun(activeRunId, {
        signal: controller.signal,
        onEvent: (evt) => handleEvent(evt, activeRunId),
        onError: () => {
          setError("The agent stream was interrupted.");
          setRunning(false);
        },
      });
    },
    [handleEvent],
  );

  const startRequest = useCallback(
    async (req: StartAgentRunRequest) => {
      resetRunState();
      setRunning(true);
      // Optimistic intent so there is never a silent wait (invariant #2).
      setIntent("Sending your instruction to Viki…");
      try {
        const { agentRunId } = await agentApi.start(documentId, req);
        setRunId(agentRunId);
        openStream(agentRunId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start the run.");
        setRunning(false);
      }
    },
    [documentId, openStream, resetRunState],
  );

  const submit = useCallback(async () => {
    if (!draft.instruction.trim()) return;
    let selectionAnchors: { start: string; end: string } | undefined;
    if (draft.scope === "selection") {
      if (rerunAnchorsRef.current) {
        selectionAnchors = rerunAnchorsRef.current;
      } else if (editor) {
        const binding = getBinding(editor.state);
        const { from, to } = editor.state.selection;
        if (binding && from !== to) {
          selectionAnchors = {
            start: absoluteToRelPos(binding, from),
            end: absoluteToRelPos(binding, to),
          };
        }
      }
    }
    rerunAnchorsRef.current = null;
    await startRequest({ instruction: draft.instruction.trim(), scope: draft.scope, selectionAnchors });
  }, [draft, editor, startRequest]);

  const answer = useCallback(
    async (text: string) => {
      if (!runId || !text.trim()) return;
      setClarifying(null);
      await startRequest({
        instruction: draft.instruction.trim(),
        scope: draft.scope,
        resumeRunId: runId,
        answer: text.trim(),
      });
    },
    [runId, draft, startRequest],
  );

  const stop = useCallback(async () => {
    abortRef.current?.abort();
    if (runId) await agentApi.stop(runId).catch(() => undefined);
    setRunning(false);
    setRunState("awaiting_review");
  }, [runId]);

  const rerun = useCallback(
    (proposal: DiffProposal) => {
      // Placeholder re-run: re-target the outdated proposal's current range and
      // let the user confirm/edit the instruction before submitting.
      rerunAnchorsRef.current = { start: proposal.anchorStart, end: proposal.anchorEnd };
      setDraft({ instruction: "", scope: "selection" });
      setActive(proposal.id);
    },
    [setActive],
  );

  const value = useMemo<AgentState>(
    () => ({
      running,
      runId,
      intent,
      runState,
      checklist,
      blocked,
      clarifying,
      error,
      draft,
      setDraft,
      submit,
      answer,
      stop,
      rerun,
    }),
    [running, runId, intent, runState, checklist, blocked, clarifying, error, draft, submit, answer, stop, rerun],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgent(): AgentState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}
