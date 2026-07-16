import Anthropic from "@anthropic-ai/sdk";
import { createId } from "../util/id.js";
import { prisma } from "../db.js";
import { getDoc } from "../yjs/docStore.js";
import { flattenFragment, anchorAtOffset, resolveAnchor, locateText } from "../yjs/anchors.js";
import { getFragment } from "../yjs/mutations.js";
import { upsertProposal } from "../proposals/broadcast.js";
import { toDTO } from "../proposals/service.js";
import { verifyHunkCitations } from "./citations.js";
import { recordUsage } from "./usage.js";
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

  emit(runId, { type: "run_state", state: "thinking" });
  emit(runId, { type: "intent", text: intentFor(instruction) });

  const doc = getDoc(documentId);
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

  const messages: Anthropic.MessageParam[] = [
    ...run.history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userContent },
  ];

  const emittedLen: number[] = [];
  const provisionalIds: string[] = [];
  let lastChecklist: string[] = [];
  let raw = "";

  const ensureId = (k: number): string => {
    if (!provisionalIds[k]) provisionalIds[k] = createId();
    return provisionalIds[k]!;
  };

  try {
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
          emit(runId, { type: "run_state", state: "drafting" });
        }
        raw += ev.delta.partial_json;

        // Live checklist.
        const cl = extractChecklist(raw);
        if (cl.length !== lastChecklist.length || cl.some((c, i) => c !== lastChecklist[i])) {
          lastChecklist = cl;
          const items: ChecklistItem[] = cl.map((label, i) => ({ id: `c${i}`, label, done: false }));
          emit(runId, { type: "checklist", items });
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

    const finalMsg = await stream.finalMessage();
    await recordUsage({ kind: "agent_run", model: MODEL, usage: finalMsg.usage, userId: run.userId, documentId });
    const toolUse = finalMsg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) throw new Error("Viki returned no tool call");

    if (toolUse.name === "ask_clarifying_question") {
      const question = String((toolUse.input as { question?: string }).question ?? "Could you clarify?");
      // Keep the run alive for resume; record turns.
      run.history.push({ role: "user", content: userContent });
      run.history.push({ role: "assistant", content: `Clarifying question: ${question}` });
      emit(runId, { type: "run_state", state: "awaiting_review" });
      emit(runId, { type: "clarifying_question", question });
      return; // run stays open; answer route resumes it
    }

    // stage_changes
    emit(runId, { type: "run_state", state: "self_checking" });
    const input = toolUse.input as { checklist?: string[]; hunks?: RawHunk[] };
    const hunks = input.hunks ?? [];
    const checklistLabels = input.checklist ?? hunks.map((_, i) => `Change ${i + 1}`);
    const checklistState: ChecklistItem[] = checklistLabels.map((label, i) => ({ id: `c${i}`, label, done: false }));

    let hunkIndex = 0;
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
      const verification = verifyHunkCitations(rawCitations);
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
          hunkIndex: hunkIndex++,
        },
      });

      await audit(documentId, "proposal_staged", run, { agentRunId: runId, proposalId: pid, detail: { hunkIndex: row.hunkIndex } });

      const dto = toDTO(row);
      upsertProposal(dto);

      if (checklistState[k]) checklistState[k]!.done = true;
      emit(runId, { type: "checklist", items: checklistState });
      emit(runId, { type: "hunk_complete", proposal: dto });
    }

    if (run.interrupted) {
      await audit(documentId, "agent_run_interrupted", run, { agentRunId: runId });
      emit(runId, { type: "run_interrupted", agentRunId: runId });
    } else {
      emit(runId, { type: "run_state", state: "awaiting_review" });
      await audit(documentId, "agent_run_completed", run, { agentRunId: runId, detail: { hunks: hunkIndex } });
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
    endRun(runId);
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
