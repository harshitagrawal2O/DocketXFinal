import type { TemplateVariable } from "@docket/shared";

const TOKEN = /\{\{\s*([\w.-]+)\s*\}\}/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Render a template body for the live preview pane: every `{{key}}` is replaced
 * with its filled value, or — when missing/empty — a highlighted `[Label]`
 * blank so the drafter sees exactly what still needs filling. Values are
 * HTML-escaped; the surrounding template markup is trusted (server-authored).
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
      return escapeHtml(raw);
    }
    const label = labels.get(key) ?? key;
    return `<span class="tpl-blank">[${escapeHtml(label)}]</span>`;
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
 */
export function substituteChips(
  bodyHtml: string,
  variables: TemplateVariable[],
): string {
  const labels = new Map(variables.map((v) => [v.key, v.label]));
  return bodyHtml.replace(TOKEN, (_match, key: string) => {
    const label = labels.get(key) ?? key;
    return (
      `<span class="tpl-chip" title="{{${escapeHtml(key)}}}">` +
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
    (match) => `<span class="tpl-token">${match}</span>`,
  );
}
