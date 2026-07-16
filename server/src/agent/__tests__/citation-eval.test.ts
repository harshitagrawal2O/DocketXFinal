import { describe, it, expect } from "vitest";
import { verifyCitation } from "../citations.js";
import type { Citation } from "@docket/shared";

/**
 * Citation-registry eval fixture (§5): a labeled set + an accuracy metric, so
 * "the deterministic citation check is good" is a number we can defend. Covers
 * valid provisions, out-of-range sections, unknown statutes, aliases, and the
 * repealed criminal codes that must be rejected in favour of the 2023 codes.
 */
interface Case {
  statute: string;
  section?: string;
  expectVerified: boolean;
  note: string;
}

const FIXTURE: Case[] = [
  { statute: "Indian Contract Act, 1872", section: "73", expectVerified: true, note: "damages — real" },
  { statute: "Indian Contract Act, 1872", section: "74", expectVerified: true, note: "liquidated damages — real" },
  { statute: "ICA", section: "10", expectVerified: true, note: "alias resolves" },
  { statute: "Companies Act, 2013", section: "149", expectVerified: true, note: "board composition — real" },
  { statute: "Companies Act, 2013", section: "999", expectVerified: false, note: "out of range" },
  { statute: "Negotiable Instruments Act, 1881", section: "138", expectVerified: true, note: "cheque dishonour — real" },
  { statute: "Arbitration and Conciliation Act, 1996", section: "34", expectVerified: true, note: "setting aside award — real" },
  { statute: "CGST Act", section: "16", expectVerified: true, note: "ITC — alias + real" },
  { statute: "Income-tax Act, 1961", section: "115BAC", expectVerified: true, note: "alphanumeric section" },
  { statute: "Income-tax Act, 1961", section: "999", expectVerified: false, note: "out of range" },
  { statute: "Bharatiya Nyaya Sanhita, 2023", section: "318", expectVerified: true, note: "current criminal code" },
  { statute: "BNSS", section: "173", expectVerified: true, note: "current procedure code alias" },
  { statute: "Bharatiya Sakshya Adhiniyam, 2023", section: "63", expectVerified: true, note: "current evidence code" },
  { statute: "Indian Penal Code, 1860", section: "420", expectVerified: false, note: "repealed -> BNS" },
  { statute: "Code of Criminal Procedure, 1973", section: "154", expectVerified: false, note: "repealed -> BNSS" },
  { statute: "Indian Evidence Act, 1872", section: "65B", expectVerified: false, note: "repealed -> BSA" },
  { statute: "Made Up Act, 2099", section: "1", expectVerified: false, note: "unknown statute" },
  { statute: "Transfer of Property Act, 1882", section: "53A", expectVerified: true, note: "part performance — real" },
  { statute: "Specific Relief Act, 1963", section: "10", expectVerified: true, note: "specific performance — real" },
  { statute: "Specific Relief Act, 1963", section: "80", expectVerified: false, note: "out of range (max 44)" },
];

describe("citation registry eval", () => {
  it("scores >= 95% accuracy on the labeled fixture", () => {
    let correct = 0;
    const misses: string[] = [];
    for (const c of FIXTURE) {
      const cite: Citation = { label: "", statute: c.statute, section: c.section, verified: null };
      const got = verifyCitation(cite).verified === true;
      if (got === c.expectVerified) correct++;
      else misses.push(`${c.statute} s.${c.section ?? "-"} (${c.note}): expected ${c.expectVerified}, got ${got}`);
    }
    const accuracy = correct / FIXTURE.length;
    // Surface the metric.
    console.log(`[eval] citation registry accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${FIXTURE.length})`);
    if (misses.length) console.log("[eval] misses:\n" + misses.join("\n"));
    expect(accuracy).toBeGreaterThanOrEqual(0.95);
  });

  it("rejects every repealed criminal code with a redirect note", () => {
    for (const s of ["Indian Penal Code, 1860", "Code of Criminal Procedure, 1973", "Indian Evidence Act, 1872"]) {
      const r = verifyCitation({ label: "", statute: s, section: "1", verified: null });
      expect(r.verified).toBe(false);
      expect(r.verificationNote).toMatch(/Bharatiya/);
    }
  });
});
