import { describe, it, expect } from "vitest";
import { summarizeAssistantTurn } from "../conversation.js";

describe("summarizeAssistantTurn", () => {
  it("prioritizes a clarifying question over anything staged", () => {
    const text = summarizeAssistantTurn({
      stagedReasonings: ["Tightened the indemnity cap"],
      blockedReasons: [],
      clarifyingQuestion: "What is the security deposit amount?",
    });
    expect(text).toBe("Asked a clarifying question: What is the security deposit amount?");
  });

  it("prioritizes an error over interruption/staged state", () => {
    const text = summarizeAssistantTurn({
      stagedReasonings: [],
      blockedReasons: [],
      interrupted: true,
      errorMessage: "Viki returned no tool call",
    });
    expect(text).toBe("Hit an error before finishing: Viki returned no tool call");
  });

  it("reports an interrupted run with partial progress", () => {
    const text = summarizeAssistantTurn({
      stagedReasonings: ["Added an arbitration clause"],
      blockedReasons: [],
      interrupted: true,
    });
    expect(text).toBe("Stopped before finishing (1 change(s) staged before the stop).");
  });

  it("reports an interrupted run with no progress", () => {
    const text = summarizeAssistantTurn({ stagedReasonings: [], blockedReasons: [], interrupted: true });
    expect(text).toBe("Stopped before making any changes.");
  });

  it("summarizes a normal completion with staged changes", () => {
    const text = summarizeAssistantTurn({
      stagedReasonings: ["Tightened the indemnity cap", "Added a 30-day notice period"],
      blockedReasons: [],
    });
    expect(text).toBe("Staged 2 change(s): (1) Tightened the indemnity cap (2) Added a 30-day notice period");
  });

  it("mentions blocked changes alongside successfully staged ones", () => {
    const text = summarizeAssistantTurn({
      stagedReasonings: ["Tightened the indemnity cap"],
      blockedReasons: ["Citation grounding failed for the Arbitration Act clause."],
    });
    expect(text).toBe(
      "Staged 1 change(s): (1) Tightened the indemnity cap 1 change(s) were blocked and dropped: Citation grounding failed for the Arbitration Act clause.",
    );
  });

  it("reports a fully blocked run with nothing staged", () => {
    const text = summarizeAssistantTurn({
      stagedReasonings: [],
      blockedReasons: ["Could not locate the target text unambiguously."],
    });
    expect(text).toBe(
      "Made no changes — nothing further was needed, or everything proposed was blocked. 1 change(s) were blocked and dropped: Could not locate the target text unambiguously.",
    );
  });
});
