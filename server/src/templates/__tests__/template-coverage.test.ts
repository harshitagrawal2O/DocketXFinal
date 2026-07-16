import { describe, it, expect } from "vitest";
import { BUILTIN_TEMPLATES } from "../builtin.js";

/**
 * Template integrity eval (§5 + §6 anti-drift): every {{placeholder}} in a
 * template body must have a declared variable, and every declared variable must
 * be used in the body. A defensible coverage number across the whole library.
 */
function placeholders(html: string): Set<string> {
  const set = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) set.add(m[1]!);
  return set;
}

describe("builtin template library integrity", () => {
  it("has templates", () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it("every placeholder is declared and every variable is used (100% coverage)", () => {
    const problems: string[] = [];
    let totalVars = 0;
    for (const t of BUILTIN_TEMPLATES) {
      const used = placeholders(t.bodyHtml);
      const declared = new Set(t.variables.map((v) => v.key));
      totalVars += declared.size;
      for (const key of used) if (!declared.has(key)) problems.push(`${t.id}: {{${key}}} used but not declared`);
      for (const key of declared) if (!used.has(key)) problems.push(`${t.id}: variable "${key}" declared but never used`);
    }
    console.log(`[eval] template coverage: ${BUILTIN_TEMPLATES.length} templates, ${totalVars} variables, ${problems.length} problems`);
    if (problems.length) console.log("[eval] problems:\n" + problems.join("\n"));
    expect(problems).toEqual([]);
  });

  it("every template has stable id, title, body, and category", () => {
    const ids = new Set<string>();
    for (const t of BUILTIN_TEMPLATES) {
      expect(t.id, `id for ${t.title}`).toBeTruthy();
      expect(ids.has(t.id), `duplicate id ${t.id}`).toBe(false);
      ids.add(t.id);
      expect(t.title).toBeTruthy();
      expect(t.bodyHtml.length).toBeGreaterThan(50);
      expect(t.category).toBeTruthy();
    }
  });
});
