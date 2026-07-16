import type { TemplateVariable } from "@docket/shared";

const TOKEN = /\{\{\s*([\w.-]+)\s*\}\}/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Variable/placeholder chip treatments — see docs/STITCH_PATTERNS.md
 * "Reconciled design decisions" (binding). Solid pill for READ-ONLY rendering
 * contexts (template preview/detail, generate-panel live preview); dashed
 * underline for EDITABLE authoring contexts (template editor preview).
 */
const SOLID_PILL_CLASS =
  "bg-secondary-container text-on-secondary-container px-1.5 rounded-sm font-semibold";
const DASHED_CHIP_CLASS =
  "bg-brass/15 text-secondary border-b-2 border-brass px-1 rounded-sm";
/** Filled-in value inside a live preview — a lighter "this came from a variable" cue. */
const FILLED_HIGHLIGHT_CLASS =
  "bg-brass/10 border-b border-dashed border-brass rounded-sm px-0.5";

/**
 * Render a template body for the live preview pane: every `{{key}}` is replaced
 * with its filled value (lightly highlighted so the drafter can see what Viki/the
 * form substituted), or — when missing/empty — a solid-pill `[Label]` blank so
 * the drafter sees exactly what still needs filling. Values are HTML-escaped;
 * the surrounding template markup is trusted (server-authored).
 */
export function substitutePreview(
  bodyHtml: string,
  variables: TemplateVariable[],
  values: Record<string, string>,
): string {
  const labels = new Map(variables.map((v) => [v.key, v.label]));
  return bodyHtml.replace(TOKEN, (_match, key: string) => {
    const raw = values[key];
    if (raw !== undefined && raw.trim() !== "") {
      return `<span class="${FILLED_HIGHLIGHT_CLASS}">${escapeHtml(raw)}</span>`;
    }
    const label = labels.get(key) ?? key;
    return `<span class="${SOLID_PILL_CLASS}">[${escapeHtml(label)}]</span>`;
  });
}

/**
 * Resolve `{{key}}` tokens inside a plain-text string (e.g. a batch title
 * pattern) against a single row of values. Missing keys collapse to empty.
 */
export function substituteText(pattern: string, values: Record<string, string>): string {
  return pattern.replace(TOKEN, (_match, key: string) => values[key] ?? "");
}

/** Distinct variable keys referenced by a template, in declaration order. */
export function variableKeys(variables: TemplateVariable[]): string[] {
  return variables.map((v) => v.key);
}

/**
 * Render a template body for the DETAIL preview: the surrounding markup is
 * rendered as-is (server-authored, trusted) while every `{{key}}` placeholder
 * becomes a highlighted inline chip showing the variable's label. Used to show
 * "what generates your document" without any values filled in yet.
 *
 * `variant` picks the chip treatment: "solid" (default) for read-only preset
 * previews, "dashed" for the editable template editor's live preview — see
 * docs/STITCH_PATTERNS.md "Reconciled design decisions".
 */
export function substituteChips(
  bodyHtml: string,
  variables: TemplateVariable[],
  variant: "solid" | "dashed" = "solid",
): string {
  const labels = new Map(variables.map((v) => [v.key, v.label]));
  const chipClass = variant === "dashed" ? DASHED_CHIP_CLASS : SOLID_PILL_CLASS;
  return bodyHtml.replace(TOKEN, (_match, key: string) => {
    const label = labels.get(key) ?? key;
    return (
      `<span class="${chipClass}" title="{{${escapeHtml(key)}}}">` +
      `${escapeHtml(label)}</span>`
    );
  });
}

/**
 * Escape the raw template body for the "Source" view and syntax-highlight the
 * `{{variable}}` tokens. Output is monospace source, safe to inject because the
 * whole string is HTML-escaped first (the token spans are the only markup).
 */
export function highlightSource(bodyHtml: string): string {
  return escapeHtml(bodyHtml).replace(
    TOKEN,
    (match) => `<span class="text-secondary font-semibold">${match}</span>`,
  );
}
