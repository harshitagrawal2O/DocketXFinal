# Build Playbook — PRD → production system

This file is a reusable blueprint. Drop it in a new project's root as `CLAUDE.md`
before handing Claude Code a PRD. It encodes the architecture, engine patterns,
and discipline that separate a demo from a production system. Apply what fits the
PRD — not every product needs a queue or a forecast layer; reach for each pattern
when its trigger below is met.

---

## 0. How to work a PRD

1. **Read the whole PRD first. Surface gaps before coding.** List ambiguities,
   missing decisions, and risky assumptions and get them resolved — do NOT paper
   over them. (Distill dense PRDs/PDFs into this CLAUDE.md so future turns don't
   re-parse them.)
2. **Name the shape.** Most products here are: *ingest external data → analyze/
   rank/generate with AI → deliver a curated, explained, sourced output → learn
   from feedback.* Decide which of the layers below the PRD actually needs.
3. **Build in verifiable increments.** After each: typecheck, run the relevant
   tests, and — before claiming "done" — exercise it in the REAL runtime, not
   just a script. State outcomes honestly (failing tests, skipped steps).
4. **Definition of done** = typecheck clean + build passes + deterministic logic
   unit-tested + verified running in the actual app. Nothing "works" until it's
   been run.

---

## 1. Default stack

- **Next.js (App Router) + React + TypeScript (strict).** Server Components by
  default; `"use client"` only where interactivity needs it.
- **PostgreSQL + Drizzle ORM.** Migrations via `drizzle-kit generate` then
  `migrate` — **never `push` on a shared/prod DB.** Add `CREATE EXTENSION IF NOT
  EXISTS vector;` to the first migration if using embeddings.
- **pgvector** for embeddings (lives in the same Postgres — no separate service).
- **Auth.js (NextAuth v5)** — Email + Google, database sessions via the Drizzle
  adapter. **Never call `auth()` or touch `db` at module scope.** Every route/
  action resolves the session and scopes queries to `session.user.id`.
- **AI**: Vercel AI SDK or the provider SDK. Prefer the latest capable models;
  make the provider swappable behind one module. Keep a graceful "no key" state.
- **UI**: Tailwind, mobile-first. A component primitive lib (Radix/shadcn) once
  the surface grows past a handful of components.
- **Secrets** from `process.env` by name. User-supplied third-party keys are
  **AES-256-GCM encrypted at rest**, decrypted only at call time, masked in UI.

---

## 2. Architecture non-negotiables

### 2a. Two processes: the web tier enqueues, a worker executes
Any operation over ~2–3s (LLM calls, scraping, multi-step pipelines) must NOT
run inline in a request/server action. It blocks the response and dies on
serverless timeouts.
- **Web tier**: validate + enqueue a job, return immediately.
- **Worker** (`scripts/worker.ts`, run under PM2 or equivalent): the only process
  that does heavy work. Use a **Postgres-backed queue (pg-boss)** so there's no
  extra infra. Bounded concurrency; scheduled fan-out for recurring work
  (`boss.schedule(...)`); a cost/staleness **gate** that skips work when there's
  no new input.

### 2b. Real-time progress via SSE — never a dead spinner
Long jobs stream progress and incremental results to the client.
- Worker `emit()`s events (`progress | item | done | error`) over **Postgres
  `LISTEN/NOTIFY`**; a `GET /stream` route `LISTEN`s and forwards to an
  `EventSource`. Stream results **one row at a time** as they're produced.
- If you truly can't stream, a time-paced stepper that narrates the *real* stages
  is the floor — cap it at 99% and keep the last stage active until results land;
  never fake "done."

### 2c. Ingestion = provider registry + one normalized shape
For multi-source ingestion, every source is a thin adapter behind a **registry**,
normalizing to ONE shape (`{ source, author, title, text, url, timestamp }`).
The engine never knows where an item came from. Adding a source = one adapter +
one registry entry; a flaky source fails independently.
- **Prefer keyless sources** (RSS, Reddit `.rss`, HN Algolia, Google News RSS,
  YouTube channel feeds). Gate paid/token sources (X, Apify) behind a friendly
  "needs a key" state — the product must work without them.
- Seed reliable sources from **hand-curated "packs"** (canonical source sets per
  vertical, defined in code) rather than trusting an LLM to emit real feed URLs.

### 2d. Service layer
Thin routes/actions → services (`library/services/*`) → db. Business logic lives
in services and pure modules, not in route handlers or components.

---

## 3. The intelligence layer (rank / recommend / analyze)

When the PRD ranks, recommends, scores, or "finds what matters," do NOT delegate
the whole judgment to one LLM call. Use a **deterministic + LLM hybrid** — it's
explainable, testable, cheaper, and defensible:

1. **Deterministic pre-score & cluster (no LLM).** Compute cheap signals and
   cluster near-duplicates so corroboration is measurable. Example momentum:
   `corroboration(distinct sources) × source-diversity × recency-decay ×
   authority × velocity`. Cluster by embedding cosine (fallback: token Jaccard).
2. **LLM for judgment only** — generate a candidate *pool* (more than needed),
   with structured output. Feed it the deterministic signals (e.g. a "momentum"
   hint), not raw noise.
3. **Adversarial verification** — a separate, skeptical pass (ideally a
   **perspective-diverse multi-vote panel**: e.g. grounding / fit / sourcing
   lenses) that fact-checks each candidate against the actual evidence. Aggregate
   by strict majority; **fail closed** (drop unverified). This turns "asserted"
   reasoning into "verified."
4. **Deterministic final ranking** — a weighted, renormalized blend of the
   signals (momentum + verified confidences + relevance + learned preference),
   with **MMR diversity** (don't return six variations of one thing) and a
   **quality gate** (return fewer, stronger items rather than filler). **Persist
   the score components** so ranking is explainable in the UI.

### Semantic layer (embeddings)
- Local embedding model (e.g. `@huggingface/transformers` MiniLM, 384-d) needs no
  key and no per-call cost — right for high-volume signal/candidate embedding.
  Use a hosted embedder only if quality demands it; keep it swappable.
- Store vectors in pgvector; for small per-request sets, do cosine in JS. Uses:
  clustering, cross-run/cross-output **dedup (novelty)**, brand **relevance**
  (cosine to a profile vector), and **learned taste** (a per-entity preference
  vector nudged toward saved / away from dismissed on each feedback event).
- **Calibrate similarity thresholds against the actual model** — measure
  within-class vs cross-class cosines and put the threshold in the gap. Don't
  guess.

### Forecasting (predict, don't just report)
If "what's emerging/next" matters: record a per-run **observation** of each
item's score (a time series), match the same item across runs by embedding
**centroid** (stable), fit a slope, and classify trajectory (emerging / surging /
peaking / fading) + a projection. Boost rising items so they surface early.

### Personalization / feedback loops
Learn at two levels: **which sources** to trust (rolling quality score from
saves/clicks/dismisses drives scan priority) AND **what content** the user likes
(the taste vector above). Both compound over time.

---

## 4. AI discipline (non-negotiable)

- **Structured outputs, schema-validated, with retries.** Never parse free text
  when a JSON-schema/tool-call mode exists. Validate at the tool boundary.
- **Anti-hallucination:** cite only URLs that appear verbatim in the provided
  context (strip invented ones); **live-probe** cited URLs before showing them;
  store only REAL fetched data as signals — never the model's narrative items.
- **Graceful degradation everywhere.** Every AI/embedding/network call is
  best-effort: on failure, fall back (lexical instead of semantic; keep the
  lineup instead of blocking) and surface a friendly state — never crash the flow.
- **Cost gates.** Skip expensive generation when inputs are unchanged; make panel
  size / model tier env-tunable (e.g. `VERIFIER_VOTES`).
- **Externalize prompts** (`prompts/*.ts`), versioned and readable.
- Record token/usage per call for metering.

---

## 5. Testing & verification

- **Unit-test every pure/deterministic function** (scoring, clustering, ranking,
  trajectory math, aggregation) — fast, no DB/model. Keep AI/DB/network at the
  edges so the core is testable. Use vitest (or `tsx` runner) with a `test`
  script.
- The LLM/queue/route layers get integration checks and a **real-runtime smoke
  test** (boot the app, run the actual flow, confirm it renders/streams).
- Include an **eval fixture** for ranking quality (a labeled set + a metric) so
  "it's good" is a number you can defend, not a vibe.

---

## 6. Anti-patterns to avoid (seen in real builds)

- ❌ Heavy work inline in a server action / request (blocks, times out).
- ❌ One giant LLM call that does relevance + ranking + reasoning + sourcing —
  unexplainable and unverifiable. Split it (§3).
- ❌ Trusting the LLM for feed URLs, config, or "what's trending" with no
  quantitative model or grounding.
- ❌ Ranking by array order the model happened to return; no persisted scores.
- ❌ Embeddings/pgvector "in the stack" but unused; string-only dedup.
- ❌ **Doc/code drift** — model names, schedules, or env vars in the README that
  don't match the code. Keep docs true or delete them.
- ❌ Tests that only cover trivial helpers while the AI/DB core is untested.
- ❌ Nested sub-apps or vendored copies left inside the repo un-ignored — they
  pollute typecheck/build and can leak into commits. Exclude in `tsconfig` +
  `.gitignore`.
- ❌ Committing secrets. `.env*` gitignored except a placeholder `.env.example`;
  verify `git status` before every commit.

---

## 7. Quick decision guide

| PRD signal | Reach for |
|---|---|
| "daily / scheduled / refresh" | queue + worker + scheduled fan-out (§2a) |
| "watch / stream / live updates" | SSE progress + incremental rows (§2b) |
| "from many sources / platforms" | provider registry + normalized shape (§2c) |
| "rank / recommend / what matters" | deterministic+LLM hybrid + verification (§3) |
| "trending / emerging / predict" | momentum + forecasting time series (§3) |
| "learns my preferences" | source-quality loop + taste vector (§3) |
| "explain why" | persist score components; show them in UI |
| user-supplied API keys | encrypt at rest, decrypt at call time (§1) |
