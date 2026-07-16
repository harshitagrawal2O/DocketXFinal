import type { Citation } from "@docket/shared";

/**
 * Citation verification (invariant #5). PORT SEAM: in production this must be
 * replaced by Docket v1's real citation-verification logic (statute database /
 * lookup service). This is a self-contained stand-in that verifies references
 * against a small registry of known Indian statutes + section ranges, so the
 * blocking path is exercised end-to-end. A failed verification BLOCKS the hunk
 * from staging.
 */

interface StatuteInfo {
  canonical: string;
  maxSection: number;
}

// Minimal known-statute registry. Extend / replace with the v1 source of truth.
const REGISTRY: Record<string, StatuteInfo> = {
  "indian contract act": { canonical: "Indian Contract Act, 1872", maxSection: 266 },
  "indian contract act, 1872": { canonical: "Indian Contract Act, 1872", maxSection: 266 },
  "companies act": { canonical: "Companies Act, 2013", maxSection: 470 },
  "companies act, 2013": { canonical: "Companies Act, 2013", maxSection: 470 },
  "income-tax act": { canonical: "Income-tax Act, 1961", maxSection: 298 },
  "income tax act": { canonical: "Income-tax Act, 1961", maxSection: 298 },
  "specific relief act": { canonical: "Specific Relief Act, 1963", maxSection: 44 },
  "arbitration and conciliation act": { canonical: "Arbitration and Conciliation Act, 1996", maxSection: 86 },
  "gst act": { canonical: "Central Goods and Services Tax Act, 2017", maxSection: 174 },
  "cgst act": { canonical: "Central Goods and Services Tax Act, 2017", maxSection: 174 },
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]+$/, "");
}

export function verifyCitation(c: Citation): Citation {
  const key = normalize(c.statute);
  const info = REGISTRY[key];
  if (!info) {
    return { ...c, verified: false, verificationNote: `Unknown statute: "${c.statute}" is not in the verified registry.` };
  }
  if (c.section) {
    const sec = parseInt(c.section.replace(/[^0-9]/g, ""), 10);
    if (Number.isNaN(sec) || sec < 1 || sec > info.maxSection) {
      return {
        ...c,
        verified: false,
        verificationNote: `Section ${c.section} is out of range for ${info.canonical} (1–${info.maxSection}).`,
      };
    }
  }
  return { ...c, label: c.label || info.canonical, verified: true, verificationNote: undefined };
}

export interface VerificationResult {
  citations: Citation[];
  ok: boolean;
  blockedReason?: string;
}

/** Verify every citation on a hunk. Any failure blocks the whole hunk. */
export function verifyHunkCitations(citations: Citation[]): VerificationResult {
  if (citations.length === 0) return { citations, ok: true };
  const verified = citations.map(verifyCitation);
  const failed = verified.filter((c) => c.verified === false);
  return {
    citations: verified,
    ok: failed.length === 0,
    blockedReason: failed.length > 0 ? failed.map((f) => f.verificationNote).join(" ") : undefined,
  };
}
