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

## Templates (library + generation)
- `GET  /api/templates` → `TemplateSummary[]` (builtin + the caller's own)
- `GET  /api/templates/:id` → `TemplateDTO` (full, incl. `bodyHtml` with `{{vars}}` + `variables`)
- `POST /api/templates` `UpsertTemplateRequest` → `TemplateDTO` (Create Template; firm-owned)
- `PUT  /api/templates/:id` `UpsertTemplateRequest` → `TemplateDTO` (edit an OWNED template; builtins 403 read-only)
- `DELETE /api/templates/:id` → `{ok:true}` (owned only; builtins 403)
- `POST /api/templates/:id/clone` → `TemplateDTO` ("Copy as New Template" — editable firm-owned copy of any visible template, incl. presets)
- Builtin templates have `ownerId: null` and `source: "builtin"` → render as read-only "System Preset"; the detail view shows `bodyHtml` with `{{variables}}` highlighted + a "Copy as New Template" action.
- `POST /api/templates/analyze` `AnalyzeTemplateRequest {text,title?}` → `TemplateDTO` (Viki turns an uploaded doc into a fillable template; source `uploaded`)
- `POST /api/templates/draft` `DraftTemplateRequest {instruction,useWebSearch?}` → `TemplateDTO` (Viki drafts a new template; source `viki`)
- `POST /api/templates/:id/generate` `GenerateFromTemplateRequest {documentTitle, values?, brief?}` → `GenerateResult {documentId, personalizationNotes?, unresolved?}`
  - `values` (no brief) = deterministic form-fill.
  - `brief` present = ADVANCED Viki personalisation: Viki drafts the whole document tailored to the case (clause-level, not just variable fill) and returns `personalizationNotes[]` (what it tailored, show to the reviewer) + `unresolved[]` (facts to confirm; left as `[TO CONFIRM: …]` blanks in the body).
- `POST /api/templates/:id/generate-batch` `GenerateBatchRequest {titlePattern, rows[]}` → `GenerateBatchResult {documentIds[]}` (one doc per row; `{{vars}}` resolved in the title too)

## Interactive intake (chat-first document creation)
Viki drives a conversation: asks what document you need, matches the template
library, asks clarifying questions, then drafts the personalised document.
- `POST /api/intake` → `IntakeStartResponse {sessionId, greeting}` (greeting is canned, no model call)
- `GET  /api/intake/:id/stream` → SSE of `IntakeSSEEvent` (`state | assistant_delta | assistant_message | template_matches | document_ready | error`)
- `POST /api/intake/:id/message` `IntakeMessageRequest {message}` → `{ok:true}` (Viki responds asynchronously over the SSE stream; 409 if still responding)
On `document_ready`, open `documentId` in the workspace (it entered the review pipeline like any generated doc), and show `personalizationNotes` / `unresolved`.

## Usage metering
Every LLM call records a `UsageEvent` (kind, model, input/output tokens, userId) — never prompt/doc content. Foundation for cost + billing.

## Export / print
- `POST /api/documents/:id/export/docx` `{ html, title }` → `.docx` binary (attachment). Client serializes the live Tiptap doc to HTML and downloads the blob.
- Print + Save-as-PDF are client-side: a Print button renders a clean print view and calls `window.print()` (a print stylesheet handles margins/page-breaks/letterhead).

## Template-generated documents (seeding)
`GET /api/documents/:id` now also returns `initialHtml: string | null`. When non-null and the
doc's Yjs XmlFragment is still empty, the FIRST client to open seeds it via
`editor.commands.setContent(initialHtml)` inside a guard (set a `seeded` flag in a Y.Map
named `meta` in the same transaction) so exactly one client seeds and all tabs converge.

## Realtime (Yjs)
- WS `VITE_YJS_WS_URL/<documentId>` — y-websocket-compatible sync + awareness.
- Proposal upserts/removals broadcast over the same doc via a Y.Map named `proposals`
  (client observes it; server writes proposal JSON on every status change) so all tabs
  stay in sync without polling. See `ProposalBroadcast` semantics.

## Streaming discipline (invariant #2)
Every SSE run emits an `intent` event before any work and a `run_state` at each
transition. `hunk_delta` grows `newText`; Accept enables only after `hunk_complete`.
