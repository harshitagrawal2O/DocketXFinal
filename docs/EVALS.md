# Docket v2 — evals

Quality as numbers, not vibes (playbook §5).

## Deterministic evals (run in CI — `npm test -w server`)

- **Citation registry accuracy** (`src/agent/__tests__/citation-eval.test.ts`) — a
  20-case labeled fixture (real provisions, out-of-range sections, unknown statutes,
  aliases, repealed criminal codes). Asserts ≥95% accuracy; currently **100% (20/20)**.
- **Template library integrity** (`src/templates/__tests__/template-coverage.test.ts`) —
  every `{{placeholder}}` is declared and every declared variable is used, across all
  builtin templates. Currently **12 templates / 142 variables / 0 problems**. Catches
  template↔variable drift (anti-pattern §6).
- **Anchoring / accept / reject / outdated** (`src/yjs/__tests__/*`) — the correctness core.

## LLM-judge eval (manual — costs tokens)

`npx tsx server/eval/generation-eval.ts` (needs `ANTHROPIC_API_KEY` + a seeded DB).
Runs labeled case briefs through the personalisation engine and scores each output with
a strict LLM judge on three axes: **completeness**, **faithfulness** (no invented
facts), **honesty** (missing facts marked `[TO CONFIRM]`, not guessed). Prints per-case
scores + averages. Extend `CASES` with your own labeled briefs to grow the set.

The citation-grounding panel (`src/agent/citationGrounding.ts`) is LLM-based and
fail-closed; its quality tracks the judge/faithfulness numbers above.
