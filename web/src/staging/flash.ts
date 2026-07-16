/**
 * Bidirectional link between the activity-feed card and the in-editor
 * decoration: scroll to the decoration for a proposalId and flash it.
 * Both views share the proposalId (see ProposalDecorations).
 */
export function flashDecoration(proposalId: string): void {
  const el = document.querySelector<HTMLElement>(
    `.ProseMirror [data-proposal-id="${cssEscape(proposalId)}"]`,
  );
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("flash");
  // Force reflow so the animation restarts if already flashed.
  void el.offsetWidth;
  el.classList.add("flash");
  window.setTimeout(() => el.classList.remove("flash"), 1200);
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
