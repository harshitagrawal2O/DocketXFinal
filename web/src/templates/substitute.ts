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
