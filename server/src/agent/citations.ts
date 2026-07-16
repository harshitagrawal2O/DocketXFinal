import type { Citation } from "@docket/shared";

/**
 * Citation verification (invariant #5) aligned to the CURRENT Indian statutory
 * framework. A failed verification BLOCKS the hunk from staging.
 *
 * PORT SEAM: in production this should defer to a live statute lookup service
 * (e.g. India Code / indiacode.nic.in) for section text. This registry is a
 * self-contained, reasonably-accurate stand-in that (a) recognises the major
 * civil/commercial/tax/criminal statutes a lawyer or CA cites, (b) sanity-checks
 * section numbers against each Act's highest section, and (c) — importantly for
 * "rules based on Indian govt" — REJECTS repealed statutes and points Viki at
 * their replacements. The 2023 criminal-law overhaul took effect 1 July 2024:
 *   IPC 1860            -> Bharatiya Nyaya Sanhita, 2023 (BNS)
 *   CrPC 1973           -> Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)
 *   Indian Evidence 1872-> Bharatiya Sakshya Adhiniyam, 2023 (BSA)
 *
 * `maxSection` is the highest section NUMBER in each Act's numbering (used only
 * as an existence sanity-check; it is not a claim that every intermediate
 * number is unrepealed). Alphanumeric sections (e.g. income-tax 115BAC) are
 * validated on their leading numeric component.
 */

interface StatuteInfo {
  canonical: string;
  maxSection: number;
  aliases: string[];
  /** If set, the statute is repealed and citing it fails verification. */
  repealedBy?: { act: string; wef: string };
}

const STATUTES: StatuteInfo[] = [
  // ---- Contract / commercial ----
  { canonical: "Indian Contract Act, 1872", maxSection: 266, aliases: ["indian contract act", "contract act", "ica"] },
  { canonical: "Sale of Goods Act, 1930", maxSection: 66, aliases: ["sale of goods act", "soga"] },
  { canonical: "Indian Partnership Act, 1932", maxSection: 74, aliases: ["indian partnership act", "partnership act"] },
  { canonical: "Specific Relief Act, 1963", maxSection: 44, aliases: ["specific relief act", "sra"] },
  { canonical: "Negotiable Instruments Act, 1881", maxSection: 147, aliases: ["negotiable instruments act", "ni act", "nia"] },
  { canonical: "Transfer of Property Act, 1882", maxSection: 137, aliases: ["transfer of property act", "topa"] },
  { canonical: "Indian Stamp Act, 1899", maxSection: 78, aliases: ["indian stamp act", "stamp act"] },
  { canonical: "Registration Act, 1908", maxSection: 91, aliases: ["registration act"] },
  { canonical: "Limitation Act, 1963", maxSection: 32, aliases: ["limitation act"] },

  // ---- Companies / insolvency / securities ----
  { canonical: "Companies Act, 2013", maxSection: 470, aliases: ["companies act", "companies act 2013"] },
  { canonical: "Limited Liability Partnership Act, 2008", maxSection: 81, aliases: ["llp act", "limited liability partnership act"] },
  { canonical: "Insolvency and Bankruptcy Code, 2016", maxSection: 255, aliases: ["insolvency and bankruptcy code", "ibc"] },
  { canonical: "Securities and Exchange Board of India Act, 1992", maxSection: 35, aliases: ["sebi act", "securities and exchange board of india act"] },
  { canonical: "Competition Act, 2002", maxSection: 66, aliases: ["competition act"] },

  // ---- Tax / GST (CA focus) ----
  { canonical: "Income-tax Act, 1961", maxSection: 298, aliases: ["income-tax act", "income tax act", "it act", "ita"] },
  { canonical: "Central Goods and Services Tax Act, 2017", maxSection: 174, aliases: ["cgst act", "gst act", "central goods and services tax act"] },
  { canonical: "Integrated Goods and Services Tax Act, 2017", maxSection: 25, aliases: ["igst act", "integrated goods and services tax act"] },
  { canonical: "Foreign Exchange Management Act, 1999", maxSection: 49, aliases: ["fema", "foreign exchange management act"] },
  { canonical: "Prevention of Money-laundering Act, 2002", maxSection: 75, aliases: ["pmla", "prevention of money-laundering act", "prevention of money laundering act"] },

  // ---- Procedure / dispute resolution ----
  { canonical: "Code of Civil Procedure, 1908", maxSection: 158, aliases: ["code of civil procedure", "cpc", "civil procedure code"] },
  { canonical: "Arbitration and Conciliation Act, 1996", maxSection: 86, aliases: ["arbitration and conciliation act", "arbitration act"] },
  { canonical: "Consumer Protection Act, 2019", maxSection: 107, aliases: ["consumer protection act", "cpa 2019"] },

  // ---- IT / data ----
  { canonical: "Information Technology Act, 2000", maxSection: 90, aliases: ["information technology act", "it act 2000"] },
  { canonical: "Digital Personal Data Protection Act, 2023", maxSection: 44, aliases: ["dpdp act", "digital personal data protection act", "dpdpa"] },

  // ---- Current criminal codes (in force from 1 July 2024) ----
  { canonical: "Bharatiya Nyaya Sanhita, 2023", maxSection: 358, aliases: ["bharatiya nyaya sanhita", "bns", "bns 2023"] },
  { canonical: "Bharatiya Nagarik Suraksha Sanhita, 2023", maxSection: 531, aliases: ["bharatiya nagarik suraksha sanhita", "bnss", "bnss 2023"] },
  { canonical: "Bharatiya Sakshya Adhiniyam, 2023", maxSection: 170, aliases: ["bharatiya sakshya adhiniyam", "bsa", "bsa 2023"] },

  // ---- Repealed criminal codes (reject + redirect) ----
  { canonical: "Indian Penal Code, 1860", maxSection: 511, aliases: ["indian penal code", "ipc", "ipc 1860"], repealedBy: { act: "Bharatiya Nyaya Sanhita, 2023", wef: "1 July 2024" } },
  { canonical: "Code of Criminal Procedure, 1973", maxSection: 484, aliases: ["code of criminal procedure", "crpc", "cr.p.c."], repealedBy: { act: "Bharatiya Nagarik Suraksha Sanhita, 2023", wef: "1 July 2024" } },
  { canonical: "Indian Evidence Act, 1872", maxSection: 167, aliases: ["indian evidence act", "evidence act", "iea"], repealedBy: { act: "Bharatiya Sakshya Adhiniyam, 2023", wef: "1 July 2024" } },
];

// Build a normalized alias -> info lookup.
const LOOKUP = new Map<string, StatuteInfo>();
for (const s of STATUTES) {
  LOOKUP.set(normalize(s.canonical), s);
  for (const a of s.aliases) LOOKUP.set(normalize(a), s);
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]+$/g, "")
    .replace(/\bact\b.*$/, (m) => m); // keep as-is; normalization is intentionally light
}

/** Resolve a cited statute name to its registry entry, tolerating trailing years/words. */
function resolve(statute: string): StatuteInfo | undefined {
  const norm = normalize(statute);
  if (LOOKUP.has(norm)) return LOOKUP.get(norm);
  // Try dropping a trailing ", <year>" and re-matching.
  const noYear = norm.replace(/,?\s*\b(1[89]\d\d|20\d\d)\b\s*$/, "").trim();
  if (LOOKUP.has(noYear)) return LOOKUP.get(noYear);
  // Try longest-alias containment (e.g. "under the companies act 2013, the ...").
  for (const [key, info] of LOOKUP) {
    if (norm.includes(key) && key.length >= 6) return info;
  }
  return undefined;
}

export function verifyCitation(c: Citation): Citation {
  const info = resolve(c.statute);
  if (!info) {
    return { ...c, verified: false, verificationNote: `Unknown statute: "${c.statute}" is not in the verified registry.` };
  }
  if (info.repealedBy) {
    return {
      ...c,
      verified: false,
      verificationNote: `${info.canonical} was repealed (w.e.f. ${info.repealedBy.wef}) and replaced by the ${info.repealedBy.act}. Cite the corresponding provision of the ${info.repealedBy.act} instead.`,
    };
  }
  if (c.section) {
    const sec = parseInt(c.section.replace(/^[^0-9]*/, "").replace(/[^0-9].*$/, ""), 10);
    if (Number.isNaN(sec) || sec < 1 || sec > info.maxSection) {
      return {
        ...c,
        verified: false,
        verificationNote: `Section ${c.section} is out of range for ${info.canonical} (valid section numbers 1–${info.maxSection}).`,
      };
    }
  }
  return { ...c, label: c.label || `${info.canonical}${c.section ? `, s. ${c.section}` : ""}`, verified: true, verificationNote: undefined };
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

/** Exposed for tests / debugging. */
export const KNOWN_STATUTES = STATUTES.map((s) => s.canonical);
