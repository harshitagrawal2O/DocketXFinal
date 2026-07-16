# Docket v2 — CLAUDE.md

## What this is

Agentic collaborative legal-document platform for Indian lawyers and CAs. Real-time multiplayer editing (Google Docs–style) of contracts, legal opinions, filings, and compliance memos, with an AI agent (**Viki**) drafting and revising alongside the humans. The product's job: automate legal/CA document production inside a firm — junior drafts, agent assists, senior reviews via diffs — with every AI change reviewable, diffable, and reversible.

Full PRD: `docs/PRD.md`. Re-read the relevant sections before starting any phase.

## Non-negotiable invariants

If a task appears to require breaking one of these, stop and ask instead of working around it.

1. **Viki never writes to the live document.** All agent output lands in a staging layer as structured diff proposals. Only an explicit human Accept turns a proposal into a Yjs transaction that syncs to collaborators.
2. **No silent waits.** Every agent run surfaces an intent line before work starts and a live state: `thinking → drafting → self-checking → awaiting review`. Output streams token-by-token into the staged diff. The UI never blocks on a full response.
3. **Rejected proposals are never deleted.** They move to the audit log with `rejected` status and remain visible (struck through, collapsible) in the activity feed.
4. **Every review action is attributed.** Accept / Reject / Edit-then-accept is written to an append-only `AuditEvent` table with user id + timestamp.
5. **Docket v1 guardrails carry over:** citation verification against Indian statutes before staging any clause that references law; Viki asks clarifying questions instead of inventing facts or figures not present in source material.
6. **Multi-clause changes are independent hunks**, individually acceptable/rejectable — never one all-or-nothing blob.
7. **Confidentiality:** never log document contents or client data to console, analytics, or error trackers. These are privileged legal documents.

## Stack (fixed — do not substitute)

| Layer           | Choice                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Realtime sync   | Yjs (CRDT) with y-websocket provider                                                                                        |
| Editor          | Tiptap (ProseMirror) + Collaboration & CollaborationCursor extensions                                                       |
| Comments        | Tiptap Comments (Pro) if a license is available; otherwise a minimal mark-based thread implementation — flag which was used |
| Agent transport | SSE streaming from backend                                                                                                  |
| Backend         | Node + Express, TypeScript                                                                                                  |
| DB              | Neon Postgres + Prisma                                                                                                      |
| AI              | Claude API — port Viki's existing prompt/guardrail logic from Docket v1, don't rewrite it                                   |
| Frontend        | React + Vite + TypeScript                                                                                                   |

Suggested layout: `web/` (Vite app), `server/` (Express + y-websocket + SSE), `docs/`, plus `packages/shared/` for types used by both if needed.

## Core data model

`DiffProposal` is the staging object and the single source of truth for both renderings — the activity-feed hunk card and the in-editor decoration are two views of the same row:

```
{
  id, documentId, agentRunId,
  anchorStart, anchorEnd,      // serialized Yjs RELATIVE positions — never absolute offsets
  oldText, newText,
  editedText?,                 // set on edit-then-accept
  reasoning, citations: Citation[],
  status: 'streaming' | 'staged' | 'accepted' | 'rejected' | 'edited_accepted' | 'outdated',
  createdAt, resolvedAt?, resolvedByUserId?
}
```

- Anchors use `Y.createRelativePositionFromTypeIndex` / `Y.createAbsolutePositionFromRelativePosition`. Absolute offsets break the moment anyone else edits the doc.
- `AuditEvent`: append-only. Covers agent runs, every proposal status transition, all review actions, and (batched) human edit sessions.

## Conflict rule (working default — confirm with Harshit before changing)

A human edit that **overlaps** a `staged` proposal's range flips it to `outdated`: Accept is blocked, the card stays visible with a "re-run on current text" action. Non-overlapping edits leave proposals staged — relative anchors keep them attached to the right text.

## Working conventions

- Build strictly phase by phase (PRD §7). Never start a phase before the previous gate passes. At each gate: stop, summarize what was built, list exact manual test steps, and wait for go-ahead.
- Plan before code for any multi-file change.
- The accept/reject/edit mutation path must have unit tests — it rewrites legal documents and must never corrupt text.
- TypeScript strict mode everywhere; no `any` in the staging/diff layer.
- Commit at every working milestone with a descriptive message.

## Commands

Monorepo with npm workspaces: `packages/shared`, `server`, `web`.

Setup (once):

- `cp .env.example .env` then fill `DATABASE_URL` (Neon), `ANTHROPIC_API_KEY`, `VIKI_MODEL`.
- `npm install` — installs all workspaces.
- `npm run db:generate` — Prisma client.
- `npm run db:migrate` — create/apply migrations against Neon.
- `npm run db:seed` — seed users, a contract doc, and mock DiffProposals.

Run:

- `npm run dev` — runs server (API on :4000, Yjs WS on :4001) and web (Vite on :5173) together.
- `npm run dev -w server` / `npm run dev -w web` — run one side.
- `npm test` — server (vitest: anchoring, accept, reject, outdated) + web tests.
- `npm run build` — typecheck/build shared → server → web.

Architecture map:

- `packages/shared/src` — DiffProposal, SSE `AgentSSEEvent`, roles/`can()`, API DTOs. Single contract for both sides.
- `server/src/yjs` — anchoring (`anchors.ts` = relative-position foundation), `mutations.ts` (accept/overlap), `docStore.ts` (gc-disabled Y.Docs + y-leveldb + snapshots), `wsServer.ts` (y-websocket-compatible rooms).
- `server/src/proposals` — `service.ts` (accept/reject/edit/outdated, idempotent, audited), `broadcast.ts` (Y.Map `proposals` syncs all tabs).
- `server/src/agent` — Viki: `vikiPrompt.ts`, `citations.ts` (verification — PORT SEAM for v1 logic), `runner.ts` (SSE streaming, scope, anchoring), `runManager.ts`, `streamParse.ts`.
- `server/src/routes` — auth, documents/members, proposals, agent-runs (SSE), versions, audit.
- `web/src` — editor (Tiptap+Yjs), staging (feed + decorations), agent (streaming UI), versions, audit.

Known seams (need real inputs before production): `DATABASE_URL`/`ANTHROPIC_API_KEY` credentials; `server/src/agent/citations.ts` is a stand-in registry — replace with Docket v1's verification; comments use the minimal mark-based implementation (no Tiptap Pro license).
