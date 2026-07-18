import "../src/loadEnv.js";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../src/db.js";
import { getTemplate, listTemplates } from "../src/templates/service.js";
import { personalizeDocument } from "../src/agent/templateAgent.js";

/**
 * Generation-quality eval (§5). Runs a labeled set of case briefs through the
 * personalisation engine and scores each output with an LLM judge on three
 * axes that matter for legal drafting:
 *   - completeness: are the brief's facts reflected?
 *   - faithfulness: NO invented facts/parties/figures/dates?
 *   - honesty: missing facts left as [TO CONFIRM: ...] rather than guessed?
 * Prints a defensible average score. Costs tokens — run manually, not in CI:
 *   npx tsx server/eval/generation-eval.ts
 */
const MODEL = process.env.VIKI_MODEL ?? "claude-opus-4-8";

interface EvalCase {
  templateMatch: RegExp;
  brief: string;
}

const CASES: EvalCase[] = [
  {
    templateMatch: /non-disclosure/i,
    brief: "Mutual NDA between Acme Robotics Pvt Ltd (Bengaluru) and Zeta Cloud LLP (Pune). 2-year term. Governing law India, arbitration seat Bengaluru.",
  },
  {
    templateMatch: /employment/i,
    brief: "Employment agreement for a Senior Software Engineer, CTC INR 42,00,000/year, 3-month probation, Bengaluru office. (Notice period NOT specified.)",
  },
  {
    templateMatch: /leave and licen/i,
    brief: "Leave & license for a 2BHK flat in Koramangala, Bengaluru; licensee Rahul Verma; monthly fee INR 55,000; 11-month term; deposit INR 3,30,000.",
  },
];

const JUDGE_TOOL: Anthropic.Tool = {
  name: "score",
  description: "Score a generated legal document against the brief.",
  input_schema: {
    type: "object",
    properties: {
      completeness: { type: "integer", description: "1-5: are the brief's facts reflected in the doc?" },
      faithfulness: { type: "integer", description: "1-5: 5 = no invented facts/parties/figures/dates; 1 = many" },
      honesty: { type: "integer", description: "1-5: 5 = missing facts marked [TO CONFIRM]; 1 = silently guessed" },
      notes: { type: "string" },
    },
    required: ["completeness", "faithfulness", "honesty", "notes"],
  },
};

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY required for the eval");
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function judge(brief: string, bodyHtml: string): Promise<{ completeness: number; faithfulness: number; honesty: number; notes: string }> {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 512,
    system: "You are a strict senior partner reviewing an AI-drafted Indian legal document against the instructing brief. Score honestly and uncharitably.",
    tools: [JUDGE_TOOL],
    tool_choice: { type: "tool", name: "score" },
    messages: [{ role: "user", content: `BRIEF:\n${brief}\n\nGENERATED DOCUMENT (HTML):\n${bodyHtml.slice(0, 6000)}` }],
  });
  const block = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  return block!.input as { completeness: number; faithfulness: number; honesty: number; notes: string };
}

async function main(): Promise<void> {
  // Eval runs against the seed user, whose bootstrap organization has no
  // databaseUrlEnc of its own — its tenant data lives on this same DATABASE_URL
  // (see schema.prisma's header), so the control-plane `prisma` client doubles
  // as the tenant client here.
  const catalog = await listTemplates(prisma, "seed-user-priya");
  const rows: { case: string; c: number; f: number; h: number; notes: string }[] = [];

  for (const ec of CASES) {
    const match = catalog.find((t) => ec.templateMatch.test(t.title));
    if (!match) {
      console.log(`[eval] no template matches ${ec.templateMatch} — skipping`);
      continue;
    }
    const template = await getTemplate(prisma, match.id, "seed-user-priya");
    if (!template) continue;
    console.log(`[eval] generating: ${template.title} …`);
    const doc = await personalizeDocument({ tenantDb: prisma, userId: "seed-user-priya" }, template, ec.brief);
    const s = await judge(ec.brief, doc.bodyHtml);
    rows.push({ case: template.title, c: s.completeness, f: s.faithfulness, h: s.honesty, notes: s.notes });
    console.log(`   completeness=${s.completeness} faithfulness=${s.faithfulness} honesty=${s.honesty}`);
    console.log(`   unresolved marked: ${doc.unresolved.length}; judge: ${s.notes.slice(0, 140)}`);
  }

  if (rows.length) {
    const avg = (k: "c" | "f" | "h") => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(2);
    console.log(`\n[eval] AVERAGES over ${rows.length} cases — completeness ${avg("c")} / faithfulness ${avg("f")} / honesty ${avg("h")} (out of 5)`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[eval] failed:", err);
  process.exit(1);
});
