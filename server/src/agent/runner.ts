import Anthropic from "@anthropic-ai/sdk";
import { createId } from "../util/id.js";
import { prisma } from "../db.js";
import { whenLoaded } from "../yjs/docStore.js";
import { flattenFragment, anchorAtOffset, resolveAnchor, locateText } from "../yjs/anchors.js";
import { getFragment } from "../yjs/mutations.js";
import { upsertProposal } from "../proposals/broadcast.js";
import { toDTO } from "../proposals/service.js";
import { verifyHunkCitationsFull } from "./citationGrounding.js";
import { recordUsage } from "./usage.js";
import { withLLMSlot } from "../llm/limiter.js";
import { SYSTEM_PROMPT, TOOLS } from "./vikiPrompt.js";
import { extractNewTexts } from "./streamParse.js";
import { emit, endRun, type ActiveRun } from "./runManager.js";
import type { Citation, ChecklistItem } from "@docket/shared";
import type { Prisma } from "@prisma/client";

const MODEL = process.env.VIKI_MODEL ?? "claude-opus-4-8";

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

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

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
  const doc = await whenLoaded(documentId);
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

  const userContent =
    `DOCUMENT${scope === "selection" ? " (selection only — you may only edit within this text)" : ""}:\n"""\n${scopedText}\n"""\n\n` +
    `INSTRUCTION: ${instruction}`;

  let messages: Anthropic.MessageParam[] = [
    ...run.history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userContent },
  ];

  // Persisted DiffProposal ordering — continues across iterations, never resets.
  let globalHunkIndex = 0;
  let totalStaged = 0;
  // Checklist items from FINISHED iterations, shown alongside the live one.
  const accumulatedChecklist: ChecklistItem[] = [];

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
      let raw = "";
      const ensureId = (k: number): string => {
        if (!provisionalIds[k]) provisionalIds[k] = createId();
        return provisionalIds[k]!;
      };

      const finalMsg = await withLLMSlot(async () => {
        const stream = client().messages.stream(
          {
            model: MODEL,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            tool_choice: { type: "any" },
            messages,
          },
          { signal: run.abort.signal },
        );

        let drafting = false;
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "input_json_delta") {
            if (!drafting) {
              drafting = true;
              if (iteration === 0) emit(runId, { type: "run_state", state: "drafting" });
            }
            raw += ev.delta.partial_json;

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
          }
        }

        return await stream.finalMessage();
      });
      await recordUsage({ kind: "agent_run", model: MODEL, usage: finalMsg.usage, userId: run.userId, documentId });
      const toolUse = finalMsg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!toolUse) throw new Error("Viki returned no tool call");

      if (toolUse.name === "ask_clarifying_question") {
        const question = String((toolUse.input as { question?: string }).question ?? "Could you clarify?");
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
        return; // run stays open; answer route resumes it
      }

      // stage_changes
      if (iteration === 0) emit(runId, { type: "run_state", state: "self_checking" });
      const input = toolUse.input as { checklist?: string[]; hunks?: RawHunk[]; done?: boolean };
      const hunks = input.hunks ?? [];
      const checklistLabels = input.checklist ?? hunks.map((_, i) => `Change ${i + 1}`);
      const iterChecklist: ChecklistItem[] = checklistLabels.map((label, i) => ({ id: `i${iteration}-c${i}`, label, done: false }));

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
        const verification = await verifyHunkCitationsFull(rawCitations, h.newText, run.userId);
        if (!verification.ok) {
          await audit(documentId, "citation_blocked", run, { agentRunId: runId, detail: { hunkIndex: k, reason: verification.blockedReason ?? "citation failed" } });
          emit(runId, { type: "hunk_blocked", hunkIndex: k, reason: verification.blockedReason ?? "Citation verification failed", citations: verification.citations });
          continue;
        }

        // Locate the target text in the CURRENT doc (may have shifted since snapshot).
        const flat = flattenFragment(getFragment(doc));
        const located = locateText(flat.text, h.oldText, h.contextBefore, h.contextAfter);
        if (!located) {
          emit(runId, { type: "hunk_blocked", hunkIndex: k, reason: "Could not locate the target text unambiguously in the current document.", citations: verification.citations });
          continue;
        }

        // Scope enforcement: selection runs may only stage inside the selection.
        if (selectionBounds && (located.start < selectionBounds.start || located.end > selectionBounds.end)) {
          console.warn(`[viki] dropped out-of-scope hunk k=${k} range=${located.start}-${located.end} bounds=${selectionBounds.start}-${selectionBounds.end}`);
          continue;
        }

        const anchorStart = anchorAtOffset(flat, located.start, 1);
        const anchorEnd = anchorAtOffset(flat, located.end, -1);
        if (!anchorStart || !anchorEnd) {
          emit(runId, { type: "hunk_blocked", hunkIndex: k, reason: "Failed to create stable anchors.", citations: verification.citations });
          continue;
        }

        const row = await prisma.diffProposal.create({
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
        upsertProposal(dto);
        totalStaged++;

        if (iterChecklist[k]) iterChecklist[k]!.done = true;
        emit(runId, { type: "checklist", items: [...accumulatedChecklist, ...iterChecklist] });
        emit(runId, { type: "hunk_complete", proposal: dto });
      }
      accumulatedChecklist.push(...iterChecklist);

      if (run.interrupted) break;

      const done = input.done ?? true; // safe default if the model omits the field
      const isLastAllowedIteration = iteration === MAX_AGENT_ITERATIONS - 1;
      if (done || isLastAllowedIteration) {
        break iterationLoop; // finalize below
      }

      // Continue the SAME run: fold this turn's tool call + result into the
      // conversation, then loop back for another pass. This is the agentic
      // step — no human re-invocation needed.
      messages = [
        ...messages,
        { role: "assistant", content: finalMsg.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: `Staged ${hunks.length} hunk(s) this pass (${totalStaged} total so far in this run). Continue only if the instruction is not yet fully addressed; otherwise call stage_changes again with an empty hunks array and done:true, or ask_clarifying_question if you need a fact.`,
            },
          ],
        },
      ];
    }

    if (run.interrupted) {
      await audit(documentId, "agent_run_interrupted", run, { agentRunId: runId });
      emit(runId, { type: "run_interrupted", agentRunId: runId });
    } else {
      emit(runId, { type: "run_state", state: "awaiting_review" });
      await audit(documentId, "agent_run_completed", run, { agentRunId: runId, detail: { hunks: totalStaged } });
      emit(runId, { type: "run_complete", agentRunId: runId });
    }
  } catch (err) {
    if (run.interrupted || (err as Error).name === "AbortError") {
      await audit(documentId, "agent_run_interrupted", run, { agentRunId: runId });
      emit(runId, { type: "run_interrupted", agentRunId: runId });
    } else {
      // Never log document contents; only the error message.
      console.error(`[viki] run ${runId} error:`, (err as Error).message);
      emit(runId, { type: "error", message: (err as Error).message });
    }
  } finally {
    endRun(runId, { awaitingAnswer });
  }
}

async function audit(
  documentId: string,
  type: string,
  run: ActiveRun,
  extra: { proposalId?: string; agentRunId?: string; detail?: Record<string, string | number | boolean | null> },
): Promise<void> {
  await prisma.auditEvent.create({
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
