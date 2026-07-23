import { Anthropic } from "@anthropic-ai/sdk";
import * as Y from "yjs";
import { createId } from "../util/id.js";
import { whenLoaded } from "../yjs/docStore.js";
import { flattenFragment, anchorAtOffset, resolveAnchor, locateText } from "../yjs/anchors.js";
import { getFragment } from "../yjs/mutations.js";
import { upsertProposal } from "../proposals/broadcast.js";
import { toDTO } from "../proposals/service.js";
import { verifyHunkCitationsFull } from "./citationGrounding.js";
import { recordUsage } from "./usage.js";
import { SYSTEM_PROMPT, TOOLS } from "./vikiPrompt.js";
import { extractNewTexts } from "./streamParse.js";
import { emit, endRun, type ActiveRun } from "./runManager.js";
import { runVikiTurn } from "./llmProvider.js";
import { loadRecentTurns, recordTurn, summarizeAssistantTurn } from "./conversation.js";
import { searchFirmDocuments, readFirmDocument } from "./tools/firmDocuments.js";
import { getOrgUserIds } from "../auth/org.js";
import type { Citation, ChecklistItem } from "@docket/shared";
import type { Prisma } from "@prisma/client";

/** Anthropic server-executed web search tool (account-gated) — same flag/pattern as templateAgent.ts. Gemini maps this to its own googleSearch grounding tool when VIKI_PROVIDER=gemini (see providers/gemini.ts). */
const WEB_SEARCH_ENABLED = process.env.VIKI_WEB_SEARCH === "true";

interface RawHunk {
  oldText: string;
  contextBefore: string;
  contextAfter: string;
  reasoning: string;
  newText: string;
  citations?: { label?: string; statute: string; section?: string }[];
}

/**
 * Hard cap on agentic turns within one run (cost/runaway-loop gate). The
 * model decides when it's actually done via stage_changes' "done" flag; this
 * is only the backstop if it keeps finding "one more thing" indefinitely.
 */
const MAX_AGENT_ITERATIONS = Math.max(1, Number(process.env.VIKI_MAX_ITERATIONS ?? 4));

/**
 * Within ONE iteration, Viki may call a read-only research tool
 * (search_documents/read_document) several times before settling on
 * stage_changes/ask_clarifying_question. Bounded separately from
 * MAX_AGENT_ITERATIONS so a research detour doesn't eat into the self-check
 * budget, but still capped — a model stuck only ever researching, never
 * producing an actual change or question, must not loop forever.
 */
const MAX_TOOL_ROUNDS = 6;

/** Tolerant scan for the checklist string array while JSON still streams. */
function extractChecklist(raw: string): string[] {
  const key = '"checklist"';
  const at = raw.indexOf(key);
  if (at === -1) return [];
  const open = raw.indexOf("[", at);
  if (open === -1) return [];
  const items: string[] = [];
  let i = open + 1;
  while (i < raw.length) {
    while (i < raw.length && raw[i] !== '"' && raw[i] !== "]") i++;
    if (i >= raw.length || raw[i] === "]") break;
    i++; // opening quote
    let s = "";
    let closed = false;
    while (i < raw.length) {
      const c = raw[i]!;
      if (c === "\\") { s += raw[i + 1] ?? ""; i += 2; continue; }
      if (c === '"') { closed = true; i++; break; }
      s += c; i++;
    }
    if (closed) items.push(s);
    else break;
  }
  return items;
}

function intentFor(instruction: string): string {
  const trimmed = instruction.trim().replace(/\s+/g, " ");
  return `Reading the document and planning changes for: "${trimmed.slice(0, 120)}${trimmed.length > 120 ? "…" : ""}"`;
}

/** Run one of the read-only research tools and report both the model-facing result and a human-facing summary. */
async function runInfoTool(
  name: "search_documents" | "read_document",
  input: unknown,
  run: ActiveRun,
  currentDocumentId: string,
  orgUserIds: string[],
): Promise<{ toolResult: string; summary: string }> {
  if (name === "search_documents") {
    const { query } = (input ?? {}) as { query?: string };
    const q = (query ?? "").trim();
    const hits = await searchFirmDocuments(run.tenantDb, orgUserIds, currentDocumentId, q);
    const summary = hits.length > 0
      ? `Searching your other documents for "${q}" — ${hits.length} result(s).`
      : `Searching your other documents for "${q}" — no matches.`;
    const toolResult =
      hits.length === 0
        ? "No other documents matched that search."
        : hits.map((h) => `[${h.id}] ${h.title} (${h.kind}, updated ${h.updatedAt}): ${h.snippet || "(empty document)"}`).join("\n\n");
    return { toolResult, summary };
  }

  const { documentId } = (input ?? {}) as { documentId?: string };
  const doc = documentId ? await readFirmDocument(run.tenantDb, orgUserIds, documentId) : null;
  if (!doc) {
    return {
      toolResult: "That document was not found, or you don't have access to it.",
      summary: "Tried to read a document, but it wasn't accessible.",
    };
  }
  await audit(currentDocumentId, "document_cross_read", run, {
    agentRunId: run.runId,
    detail: { sourceDocumentId: documentId ?? "" },
  });
  return {
    toolResult: `TITLE: ${doc.title}\n\n${doc.text}${doc.truncated ? "\n\n[...truncated]" : ""}`,
    summary: `Read "${doc.title}"${doc.truncated ? " (truncated)" : ""}.`,
  };
}

/**
 * Run Viki against a document and stage the resulting hunks. Emits the full SSE
 * event sequence (intent → run_state → checklist → hunk_delta → hunk_complete →
 * run_complete). Honors interruption: completed hunks stay staged, the in-flight
 * hunk is discarded, the run is marked interrupted in the audit log.
 */
export async function runAgent(run: ActiveRun): Promise<void> {
  const { runId, documentId, instruction, scope } = run;

  let awaitingAnswer = false;

  emit(runId, { type: "run_state", state: "thinking" });
  emit(runId, { type: "intent", text: intentFor(instruction) });

  // getDoc() alone can race the async leveldb load on a doc's first access in
  // this process (returns a fresh, momentarily-empty Y.Doc) — await the load.
  const doc = await whenLoaded(run.tenantDb, documentId);
  const snapshot = flattenFragment(getFragment(doc)).text;

  // Selection-scoped bounds resolved against the current doc.
  let selectionBounds: { start: number; end: number } | null = null;
  if (scope === "selection" && run.selection) {
    const flat = flattenFragment(getFragment(doc));
    const a = resolveAnchor(doc, flat, run.selection.start);
    const b = resolveAnchor(doc, flat, run.selection.end);
    if (a && b) selectionBounds = { start: Math.min(a.globalOffset, b.globalOffset), end: Math.max(a.globalOffset, b.globalOffset) };
  }

  const scopedText = selectionBounds ? snapshot.slice(selectionBounds.start, selectionBounds.end) : snapshot;
  const isEmptyDraft = scope === "document" && scopedText.trim().length === 0;

  if (isEmptyDraft) {
    // This agent normally locates and replaces EXISTING text via oldText —
    // meaningless on a blank page. Rather than redirect the user to a
    // different tool, handle "draft the whole thing" right here: an
    // empty-oldText hunk anchored at position 0 is a valid insert (see
    // locateText's empty-document special case), but an anchor still needs
    // an actual Y.XmlText LEAF to attach to, and a truly empty fragment has
    // none. Bootstrap one empty paragraph so the normal staging/anchoring/
    // streaming machinery below works completely unchanged from here on —
    // same live token streaming, same Accept/Reject review, no new code path.
    const frag = getFragment(doc);
    if (frag.length === 0) {
      doc.transact(() => {
        const el = new Y.XmlElement("paragraph");
        frag.insert(0, [el]);
        el.insert(0, [new Y.XmlText()]);
      }, "viki-bootstrap");
    }
  }

  const userContent = isEmptyDraft
    ? `The document is currently EMPTY.\n\nINSTRUCTION: ${instruction}\n\n` +
      `Draft the complete document to fulfil this instruction. Propose it as a SINGLE hunk with oldText set to "" (empty string) — that inserts your content at the start of the document. Use blank lines between sections/paragraphs (this is plain text, not HTML) and a clear heading line for the title and each numbered section.`
    : `DOCUMENT${scope === "selection" ? " (selection only — you may only edit within this text)" : ""}:\n"""\n${scopedText}\n"""\n\n` +
      `INSTRUCTION: ${instruction}`;

  // Persistent cross-run memory: prior completed runs on this document, oldest
  // first. Distinct from run.history below, which only carries THIS run's own
  // in-progress thread (populated only when resuming after a clarifying
  // question) — persisted turns come from runs that already fully ended.
  const persistedTurns = await loadRecentTurns(run.tenantDb, documentId);

  // Record the human side of this turn once, up front: on a fresh run that's
  // the instruction; on a resume (answering a clarifying question) it's the
  // answer agentRuns.ts already pushed onto run.history just before calling
  // us, not the (already-recorded, on the original run) original instruction.
  const isFreshRun = run.history.length === 0;
  const humanTurnText = isFreshRun ? instruction : (run.history[run.history.length - 1]?.content ?? instruction);
  await recordTurn(run.tenantDb, documentId, runId, "user", humanTurnText);

  let messages: Anthropic.MessageParam[] = [
    ...persistedTurns,
    ...run.history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userContent },
  ];

  // Fetched lazily, once, only if Viki actually calls a research tool this
  // run — the org's own member ids, used to scope search_documents/
  // read_document to THIS firm even when its tenant data shares the
  // platform's default database with other organizations (see
  // firmDocuments.ts and auth/org.ts's getOrgUserIds).
  let orgUserIdsCache: string[] | null = null;
  const getCachedOrgUserIds = async (): Promise<string[]> => {
    if (!orgUserIdsCache) orgUserIdsCache = await getOrgUserIds(run.organizationId);
    return orgUserIdsCache;
  };

  // Persisted DiffProposal ordering — continues across iterations, never resets.
  let globalHunkIndex = 0;
  let totalStaged = 0;
  // Checklist items from FINISHED iterations, shown alongside the live one.
  const accumulatedChecklist: ChecklistItem[] = [];
  // Distilled for the persistent conversation-memory turn recorded on exit.
  const stagedReasonings: string[] = [];
  const allBlockedReasons: string[] = [];
  let assistantSummary: string | null = null;

  const tools: Anthropic.ToolUnion[] = [...TOOLS];
  if (WEB_SEARCH_ENABLED) {
    // Anthropic server-side web search tool; executed by the API within the
    // turn — no manual round-trip needed (see llmProvider.ts's server_tool_use
    // handling for the live "searching the web" indicator).
    tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 3 } as unknown as Anthropic.ToolUnion);
  }
  // Forcing a specific custom tool (tool_choice:any) conflicts with letting
  // the server-side web_search tool call itself autonomously first — same
  // tradeoff templateAgent.ts makes; only relax to auto when search is on.
  const toolChoice: Anthropic.MessageCreateParamsStreaming["tool_choice"] = WEB_SEARCH_ENABLED
    ? { type: "auto" }
    : { type: "any" };

  try {
    iterationLoop: for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration++) {
      if (run.interrupted) break;

      // Iteration 0 is the initial draft; later iterations are Viki checking
      // its own prior work in this run before deciding whether to continue —
      // this is what makes the run genuinely agentic rather than one-shot.
      if (iteration > 0) {
        emit(runId, { type: "run_state", state: "self_checking" });
        emit(runId, {
          type: "intent",
          text: "Reviewing the proposed changes so far and checking whether anything the instruction asked for is still missing…",
        });
      }

      const emittedLen: number[] = [];
      const provisionalIds: string[] = [];
      let lastChecklist: string[] = [];
      const ensureId = (k: number): string => {
        if (!provisionalIds[k]) provisionalIds[k] = createId();
        return provisionalIds[k]!;
      };

      // One outer iteration may involve several model calls: zero or more
      // read-only research calls (search_documents/read_document), then the
      // one that actually decides stage_changes/ask_clarifying_question.
      // Definite-assignment (!): every path through the loop below either
      // assigns both and breaks, continues, or throws — never falls through.
      let toolUse!: Anthropic.ToolUseBlock;
      let assistantContent!: Anthropic.MessageParam["content"];
      toolRoundLoop: for (let toolRound = 0; ; toolRound++) {
        if (toolRound >= MAX_TOOL_ROUNDS) {
          throw new Error("Viki made too many research calls without producing a change or a question.");
        }

        const result = await runVikiTurn({
          organizationId: run.organizationId,
          system: SYSTEM_PROMPT,
          tools,
          toolChoice,
          messages,
          maxTokens: 4096,
          signal: run.abort.signal,
          onDraftingStart: () => {
            if (iteration === 0 && toolRound === 0) emit(runId, { type: "run_state", state: "drafting" });
          },
          onServerToolUse: () => {
            emit(runId, { type: "tool_call", tool: "web_search", detail: "Searching the web for supporting or current statutory text…" });
          },
          onRawJsonDelta: (raw) => {
            // Live checklist: this iteration's items alongside prior ones.
            const cl = extractChecklist(raw);
            if (cl.length !== lastChecklist.length || cl.some((c, i) => c !== lastChecklist[i])) {
              lastChecklist = cl;
              const liveItems: ChecklistItem[] = cl.map((label, i) => ({ id: `i${iteration}-c${i}`, label, done: false }));
              emit(runId, { type: "checklist", items: [...accumulatedChecklist, ...liveItems] });
            }

            // Live newText streaming per hunk.
            const texts = extractNewTexts(raw);
            for (let k = 0; k < texts.length; k++) {
              const prev = emittedLen[k] ?? 0;
              const full = texts[k]!;
              if (full.length > prev) {
                const pid = ensureId(k);
                emit(runId, { type: "hunk_delta", proposalId: pid, delta: full.slice(prev) });
                emittedLen[k] = full.length;
              }
            }
          },
        });
        await recordUsage({ tenantDb: run.tenantDb, organizationId: run.organizationId, kind: "agent_run", model: result.modelUsed, usage: result.usage, userId: run.userId, documentId });

        const tu = result.toolUse;
        if (!tu) throw new Error("Viki returned no tool call");

        if (tu.name === "search_documents" || tu.name === "read_document") {
          const orgUserIds = await getCachedOrgUserIds();
          const { toolResult, summary } = await runInfoTool(tu.name, tu.input, run, documentId, orgUserIds);
          emit(runId, { type: "tool_call", tool: tu.name, detail: summary });
          messages = [
            ...messages,
            { role: "assistant", content: result.assistantContent },
            { role: "user", content: [{ type: "tool_result", tool_use_id: tu.id, content: toolResult }] },
          ];
          continue toolRoundLoop;
        }

        toolUse = tu;
        assistantContent = result.assistantContent;
        break toolRoundLoop;
      }

      if (toolUse!.name === "ask_clarifying_question") {
        const question = String((toolUse!.input as { question?: string }).question ?? "Could you clarify?");
        // Keep the run alive for resume; record turns (with a summary of any
        // work already staged in this run, so resuming doesn't lose context).
        run.history.push({ role: "user", content: userContent });
        run.history.push({
          role: "assistant",
          content:
            totalStaged > 0
              ? `Staged ${totalStaged} hunk(s) so far in this run before needing to ask: ${question}`
              : `Clarifying question: ${question}`,
        });
        emit(runId, { type: "run_state", state: "awaiting_review" });
        emit(runId, { type: "clarifying_question", question });
        awaitingAnswer = true;
        assistantSummary = summarizeAssistantTurn({ stagedReasonings, blockedReasons: allBlockedReasons, clarifyingQuestion: question });
        return; // run stays open; answer route resumes it
      }

      // stage_changes
      if (iteration === 0) emit(runId, { type: "run_state", state: "self_checking" });
      const input = toolUse!.input as { checklist?: string[]; hunks?: RawHunk[]; done?: boolean };
      const hunks = input.hunks ?? [];
      const checklistLabels = input.checklist ?? hunks.map((_, i) => `Change ${i + 1}`);
      const iterChecklist: ChecklistItem[] = checklistLabels.map((label, i) => ({ id: `i${iteration}-c${i}`, label, done: false }));
      const blockedThisIteration: string[] = [];

      for (let k = 0; k < hunks.length; k++) {
        if (run.interrupted) break;
        const h = hunks[k]!;
        const pid = ensureId(k);

        // Citation verification (blocks staging on failure).
        const rawCitations: Citation[] = (h.citations ?? []).map((c) => ({
          label: c.label ?? "",
          statute: c.statute,
          section: c.section,
          verified: null,
        }));
        // Deterministic registry pre-check + adversarial grounding, fail closed.
        const verification = await verifyHunkCitationsFull(rawCitations, h.newText, {
          tenantDb: run.tenantDb,
          organizationId: run.organizationId,
          userId: run.userId,
        });
        if (!verification.ok) {
          const reason = verification.blockedReason ?? "Citation verification failed";
          await audit(documentId, "citation_blocked", run, { agentRunId: runId, detail: { hunkIndex: k, reason } });
          emit(runId, { type: "hunk_blocked", proposalId: pid, hunkIndex: k, reason, citations: verification.citations });
          blockedThisIteration.push(reason);
          continue;
        }

        // Locate the target text in the CURRENT doc (may have shifted since snapshot).
        const flat = flattenFragment(getFragment(doc));
        const located = locateText(flat.text, h.oldText, h.contextBefore, h.contextAfter);
        if (!located) {
          const reason =
            flat.text.trim().length === 0
              ? 'The document is empty and this hunk did not use oldText: "" to insert — could not locate where to place it.'
              : "Could not locate the target text unambiguously in the current document.";
          emit(runId, { type: "hunk_blocked", proposalId: pid, hunkIndex: k, reason, citations: verification.citations });
          blockedThisIteration.push(reason);
          continue;
        }

        // Scope enforcement: selection runs may only stage inside the selection.
        if (selectionBounds && (located.start < selectionBounds.start || located.end > selectionBounds.end)) {
          console.warn(`[viki] dropped out-of-scope hunk k=${k} range=${located.start}-${located.end} bounds=${selectionBounds.start}-${selectionBounds.end}`);
          const reason = "This change falls outside the selection you scoped the run to, so it was dropped.";
          emit(runId, { type: "hunk_blocked", proposalId: pid, hunkIndex: k, reason, citations: verification.citations });
          blockedThisIteration.push(reason);
          continue;
        }

        const anchorStart = anchorAtOffset(flat, located.start, 1);
        const anchorEnd = anchorAtOffset(flat, located.end, -1);
        if (!anchorStart || !anchorEnd) {
          const reason = "Failed to create stable anchors.";
          emit(runId, { type: "hunk_blocked", proposalId: pid, hunkIndex: k, reason, citations: verification.citations });
          blockedThisIteration.push(reason);
          continue;
        }

        const row = await run.tenantDb.diffProposal.create({
          data: {
            id: pid,
            documentId,
            agentRunId: runId,
            anchorStart,
            anchorEnd,
            oldText: h.oldText,
            newText: h.newText,
            reasoning: h.reasoning,
            citations: verification.citations as unknown as Prisma.InputJsonValue,
            status: "staged",
            hunkIndex: globalHunkIndex++,
          },
        });

        await audit(documentId, "proposal_staged", run, { agentRunId: runId, proposalId: pid, detail: { hunkIndex: row.hunkIndex } });

        const dto = toDTO(row);
        upsertProposal(run.tenantDb, dto);
        totalStaged++;
        stagedReasonings.push(h.reasoning);

        if (iterChecklist[k]) iterChecklist[k]!.done = true;
        emit(runId, { type: "checklist", items: [...accumulatedChecklist, ...iterChecklist] });
        emit(runId, { type: "hunk_complete", proposal: dto });
      }
      accumulatedChecklist.push(...iterChecklist);
      allBlockedReasons.push(...blockedThisIteration);

      if (run.interrupted) break;

      const isLastAllowedIteration = iteration === MAX_AGENT_ITERATIONS - 1;

      // A whole-document draft is ONE hunk (see isEmptyDraft above) — if it
      // gets blocked, EVERYTHING is lost, not just one clause, which is a far
      // worse outcome than the normal per-clause case. Rather than accept
      // that, force a self-correcting continuation: tell Viki exactly what
      // was blocked and why, and have it redraft without the problem —
      // reusing the same agentic continuation as a genuine "done:false" turn.
      const shouldForceRetry = isEmptyDraft && totalStaged === 0 && blockedThisIteration.length > 0 && !isLastAllowedIteration;

      const done = input.done ?? true; // safe default if the model omits the field
      if (!shouldForceRetry && (done || isLastAllowedIteration)) {
        assistantSummary = summarizeAssistantTurn({ stagedReasonings, blockedReasons: allBlockedReasons });
        break iterationLoop; // finalize below
      }

      // Continue the SAME run: fold this turn's tool call + result into the
      // conversation, then loop back for another pass. This is the agentic
      // step — no human re-invocation needed.
      const continuationNote = shouldForceRetry
        ? `Nothing could be staged this pass — every proposed hunk was blocked: ${blockedThisIteration.join(" ")} Redraft the SAME document addressing this (e.g. remove or fix the problematic citation) and propose it again as a single hunk with oldText: "".`
        : `Staged ${hunks.length} hunk(s) this pass (${totalStaged} total so far in this run). Continue only if the instruction is not yet fully addressed; otherwise call stage_changes again with an empty hunks array and done:true, or ask_clarifying_question if you need a fact.`;
      messages = [
        ...messages,
        { role: "assistant", content: assistantContent! },
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: toolUse!.id, content: continuationNote }],
        },
      ];
    }

    if (run.interrupted) {
      assistantSummary = summarizeAssistantTurn({ stagedReasonings, blockedReasons: allBlockedReasons, interrupted: true });
      await audit(documentId, "agent_run_interrupted", run, { agentRunId: runId });
      emit(runId, { type: "run_interrupted", agentRunId: runId });
    } else {
      emit(runId, { type: "run_state", state: "awaiting_review" });
      await audit(documentId, "agent_run_completed", run, { agentRunId: runId, detail: { hunks: totalStaged } });
      emit(runId, { type: "run_complete", agentRunId: runId });
    }
  } catch (err) {
    if (run.interrupted || (err as Error).name === "AbortError") {
      assistantSummary = summarizeAssistantTurn({ stagedReasonings, blockedReasons: allBlockedReasons, interrupted: true });
      await audit(documentId, "agent_run_interrupted", run, { agentRunId: runId });
      emit(runId, { type: "run_interrupted", agentRunId: runId });
    } else {
      // Never log document contents; only the error message.
      console.error(`[viki] run ${runId} error:`, (err as Error).message);
      assistantSummary = summarizeAssistantTurn({ stagedReasonings, blockedReasons: allBlockedReasons, errorMessage: (err as Error).message });
      emit(runId, { type: "error", message: (err as Error).message });
    }
  } finally {
    if (assistantSummary) await recordTurn(run.tenantDb, documentId, runId, "assistant", assistantSummary);
    endRun(runId, { awaitingAnswer });
  }
}

async function audit(
  documentId: string,
  type: string,
  run: ActiveRun,
  extra: { proposalId?: string; agentRunId?: string; detail?: Record<string, string | number | boolean | null> },
): Promise<void> {
  await run.tenantDb.auditEvent.create({
    data: {
      documentId,
      type,
      userId: run.userId,
      userName: run.userName,
      proposalId: extra.proposalId ?? null,
      agentRunId: extra.agentRunId ?? null,
      detail: (extra.detail ?? null) as Prisma.InputJsonValue,
    },
  });
}
