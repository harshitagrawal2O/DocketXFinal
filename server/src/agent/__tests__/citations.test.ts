import { describe, it, expect } from "vitest";
import { verifyCitation, verifyHunkCitations } from "../citations.js";
import type { Citation } from "@docket/shared";

const cite = (statute: string, section?: string): Citation => ({ label: "", statute, section, verified: null });

describe("citation verification (invariant #5)", () => {
  it("verifies a real in-force provision", () => {
    const r = verifyCitation(cite("Indian Contract Act, 1872", "73"));
    expect(r.verified).toBe(true);
    expect(r.label).toContain("Indian Contract Act");
  });

  it("accepts common aliases and alphanumeric sections", () => {
    expect(verifyCitation(cite("ICA", "74")).verified).toBe(true);
    // Income-tax alphanumeric section validated on its leading number.
    expect(verifyCitation(cite("Income-tax Act, 1961", "115BAC")).verified).toBe(true);
  });

  it("rejects an out-of-range section", () => {
    const r = verifyCitation(cite("Companies Act, 2013", "999"));
    expect(r.verified).toBe(false);
    expect(r.verificationNote).toMatch(/out of range/i);
  });

  it("rejects an unknown statute", () => {
    expect(verifyCitation(cite("Made Up Act, 2050", "1")).verified).toBe(false);
  });

  it("rejects repealed criminal codes and points to the replacement", () => {
    const ipc = verifyCitation(cite("Indian Penal Code, 1860", "420"));
    expect(ipc.verified).toBe(false);
    expect(ipc.verificationNote).toMatch(/Bharatiya Nyaya Sanhita, 2023/);

    const crpc = verifyCitation(cite("Code of Criminal Procedure, 1973", "154"));
    expect(crpc.verificationNote).toMatch(/Bharatiya Nagarik Suraksha Sanhita, 2023/);

    const evidence = verifyCitation(cite("Indian Evidence Act, 1872", "65B"));
    expect(evidence.verificationNote).toMatch(/Bharatiya Sakshya Adhiniyam, 2023/);
  });

  it("accepts the current (post-2024) criminal codes", () => {
    expect(verifyCitation(cite("Bharatiya Nyaya Sanhita, 2023", "318")).verified).toBe(true);
    expect(verifyCitation(cite("BNSS", "173")).verified).toBe(true);
  });

  it("blocks the whole hunk if ANY citation fails", () => {
    const result = verifyHunkCitations([cite("Indian Contract Act, 1872", "73"), cite("Indian Penal Code, 1860", "420")]);
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toMatch(/Bharatiya Nyaya Sanhita/);
  });

  it("passes a hunk with no citations", () => {
    expect(verifyHunkCitations([]).ok).toBe(true);
  });
});
