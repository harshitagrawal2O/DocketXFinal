import { Anthropic } from "@anthropic-ai/sdk";
import type { PrismaClient } from "@prisma/client";
import type { Citation } from "@docket/shared";
import { verifyHunkCitations, type VerificationResult } from "./citations.js";
import { withLLMSlot } from "../llm/limiter.js";
import { resolveAnthropicApiKey } from "../llm/orgApiKey.js";
import { recordUsage } from "./usage.js";
import { isLLMAvailable } from "../llm/availability.js";

/**
 * Adversarial citation grounding (§3 verification / §4 anti-hallucination).
 *
 * The registry in citations.ts is a fast deterministic pre-check (does the
 * statute + section exist and is it in force). It CANNOT tell whether a real
 * section is being cited for a proposition it does not actually support. This
 * layer adds a skeptical, perspective-diverse LLM panel that grounds each
 * citation against the actual clause text and FAILS CLOSED: a citation must win
 * a strict majority of "supported AND in force" votes or the hunk is blocked.
 *
 * PORT SEAM: the authoritative grounding source is India Code
 * (indiacode.nic.in) — the panel should ultimately check section TEXT, not just
 * model knowledge. Wire that in for true production accuracy.
 */

const MODEL = process.env.VIKI_MODEL ?? "claude-opus-4-8";
const VOTES = Math.max(1, Number(process.env.CITATION_VERIFY_VOTES ?? 2));

const LENSES = [
  "Existence & currency: does this exact section exist and is it in force today under the current Indian statutory framework (post-2024 criminal codes: BNS/BNSS/BSA, not IPC/CrPC/Evidence Act)?",
  "Support: does the cited section genuinely support the specific legal proposition it is attached to — not merely the same general area of law?",
];

const ASSESS_TOOL: Anthropic.Tool = {
  name: "assess_citation",
  description: "Strictly assess whether a statutory citation is real, in force, and genuinely supports the proposition. Default to unsupported if uncertain.",
  input_schema: {
    type: "object",
    properties: {
      supported: { type: "boolean", description: "true only if the section genuinely supports the proposition" },
      inForce: { type: "boolean", description: "true only if the statute+section exists and is currently in force" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      reason: { type: "string" },
    },
    required: ["supported", "inForce", "confidence", "reason"],
  },
};

interface Vote {
  supported: boolean;
  inForce: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
}

interface GroundingContext {
  tenantDb: PrismaClient;
  organizationId?: string | null;
  userId?: string;
}

async function castVote(citation: Citation, proposition: string, lens: string, ctx: GroundingContext): Promise<Vote | null> {
  try {
    const apiKey = await resolveAnthropicApiKey(ctx.organizationId);
    const msg = await withLLMSlot(() =>
      new Anthropic({ apiKey }).messages.create({
        model: MODEL,
        max_tokens: 512,
        system: `You are a skeptical Indian-law citation checker. Be strict and uncharitable: if you are not confident the citation is real, in force, AND genuinely supports the proposition, mark it unsupported. Focus on this lens — ${lens}`,
        tools: [ASSESS_TOOL],
        tool_choice: { type: "tool", name: "assess_citation" },
        messages: [
          {
            role: "user",
            content: `PROPOSITION (from a draft legal clause):\n"${proposition.slice(0, 1200)}"\n\nCITATION: ${citation.statute}${citation.section ? `, section ${citation.section}` : ""}\n\nAssess it.`,
          },
        ],
      }),
    );
    await recordUsage({ tenantDb: ctx.tenantDb, organizationId: ctx.organizationId, kind: "agent_run", model: MODEL, usage: msg.usage, userId: ctx.userId });
    const block = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "assess_citation");
    if (!block) return null;
    return block.input as Vote;
  } catch {
    return null; // fail closed — a failed vote counts as no support
  }
}

/** Ground a single citation with a perspective-diverse panel; fail closed. */
async function groundCitation(citation: Citation, proposition: string, ctx: GroundingContext): Promise<{ ok: boolean; note?: string }> {
  const lenses = Array.from({ length: VOTES }, (_, i) => LENSES[i % LENSES.length]!);
  const votes = await Promise.all(lenses.map((lens) => castVote(citation, proposition, lens, ctx)));
  const valid = votes.filter((v): v is Vote => v !== null);
  if (valid.length === 0) return { ok: false, note: "Citation could not be verified (grounding unavailable)." };

  const good = valid.filter((v) => v.supported && v.inForce && v.confidence !== "low");
  const ok = good.length > valid.length / 2; // strict majority
  if (ok) return { ok: true };
  const reason = valid.find((v) => !v.supported || !v.inForce)?.reason ?? "Citation not sufficiently grounded.";
  return { ok: false, note: reason };
}

/**
 * Full verification: deterministic registry pre-check, then adversarial
 * grounding of each surviving citation. If the LLM is unavailable, fall back to
 * the registry result (graceful degradation).
 */
export async function verifyHunkCitationsFull(
  citations: Citation[],
  proposition: string,
  ctx: GroundingContext,
): Promise<VerificationResult> {
  const pre = verifyHunkCitations(citations);
  if (!pre.ok || citations.length === 0) return pre;
  if (!isLLMAvailable()) return pre; // registry-only fallback

  const grounded: Citation[] = [];
  const failures: string[] = [];
  for (const c of pre.citations) {
    const result = await groundCitation(c, proposition, ctx);
    if (result.ok) {
      grounded.push({ ...c, verified: true });
    } else {
      grounded.push({ ...c, verified: false, verificationNote: result.note });
      failures.push(`${c.statute}${c.section ? ` s.${c.section}` : ""}: ${result.note}`);
    }
  }
  return {
    citations: grounded,
    ok: failures.length === 0,
    blockedReason: failures.length > 0 ? `Citation grounding failed — ${failures.join("; ")}` : undefined,
  };
}
