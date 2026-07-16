# Docket v2 — HTTP / SSE / WS contract

All types are imported from `@docket/shared`. Base URL: `VITE_API_URL` (default `http://localhost:4000`).
Auth: session cookie `docket_session` (set by login). Dev shortcut header `x-user-id` also accepted.

## Auth
- `POST /api/auth/register` `{ email, name, password }` → `SessionUser` (sets cookie)
- `POST /api/auth/login` `{ email, password }` → `SessionUser` (sets cookie)
- `POST /api/auth/logout` → `{ ok: true }`
- `GET  /api/auth/me` → `SessionUser | 401`

## Documents
- `GET  /api/documents` → `DocumentSummary[]` (docs the user is a member of)
- `POST /api/documents` `{ title, kind }` → `DocumentSummary` (caller becomes owner)
- `GET  /api/documents/:id` → `{ summary: DocumentSummary, members: {userId,name,role}[] }`
- `POST /api/documents/:id/members` `{ email, role }` → member (owner only)
- `PATCH /api/documents/:id/members/:userId` `{ role }` → member (owner only)

## Proposals (staging layer)
- `GET  /api/documents/:id/proposals` → `DiffProposal[]` (all non-terminal + recent)
- `POST /api/proposals/:pid/accept` → `ProposalActionResult` (review cap; idempotent)
- `POST /api/proposals/:pid/reject` → `ProposalActionResult` (review cap; idempotent)
- `POST /api/proposals/:pid/edit-accept` `{ editedText }` → `ProposalActionResult`
- `POST /api/documents/:id/mark-outdated` `{ proposalIds: string[] }` → `DiffProposal[]` (client detects overlap in ProseMirror coords and sends the ids; server flips those still `staged`)

## Agent runs (Viki)
- `POST /api/documents/:id/agent-runs` `StartAgentRunRequest` → `StartAgentRunResponse` (run_agent cap)
- `GET  /api/agent-runs/:runId/stream` → SSE stream of `AgentSSEEvent`
- `POST /api/agent-runs/:runId/stop` → `{ ok: true }` (interrupt; completed hunks stay staged)

## Versions (Phase 5)
- `GET  /api/documents/:id/versions` → `VersionSummary[]`
- `POST /api/documents/:id/versions` `{ name }` → `VersionSummary` (manual save)
- `GET  /api/documents/:id/versions/:vid/text` → `{ text: string }`
- `GET  /api/documents/:id/versions/diff?from=:vid&to=:vid` → `{ fromText, toText }`
- `POST /api/documents/:id/versions/:vid/rollback` → `VersionSummary` (creates a new version)

## Audit
- `GET /api/documents/:id/audit?cursor=&type=` → `AuditPage`

## Realtime (Yjs)
- WS `VITE_YJS_WS_URL/<documentId>` — y-websocket-compatible sync + awareness.
- Proposal upserts/removals broadcast over the same doc via a Y.Map named `proposals`
  (client observes it; server writes proposal JSON on every status change) so all tabs
  stay in sync without polling. See `ProposalBroadcast` semantics.

## Streaming discipline (invariant #2)
Every SSE run emits an `intent` event before any work and a `run_state` at each
transition. `hunk_delta` grows `newText`; Accept enables only after `hunk_complete`.
