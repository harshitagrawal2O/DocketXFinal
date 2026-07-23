# Deploying Docket v2

Three services, two platforms. This split exists because Yjs's realtime
collaboration needs one persistent, stateful process holding each document's
live CRDT state in memory — that's fundamentally incompatible with
serverless functions (which are stateless and horizontally scaled; two
requests for the "same" document could land on two different instances with
two different, unsynced copies). The background job queue (`pg-boss`) has
the same "needs a persistent process" requirement. The REST/SSE API has no
such constraint and deploys to serverless cleanly.

| Service | What | Where | Entry point |
|---|---|---|---|
| **web** | The React/Vite SPA | Vercel | `web/` (static build) |
| **api** | Express REST + SSE agent-run streaming | Vercel | `server/server.ts` |
| **realtime** | Yjs WS server + queue worker | Render (needs an always-on process) | `server/src/realtimeEntry.ts` |

Local dev is unaffected — `npm run dev` still runs everything in one
process via `server/src/index.ts`, exactly as before.

## Why Postgres, not local disk, for live document content

The realtime service on Render's free tier has no persistent disk — local
files are wiped on every restart or idle-spindown. Live Yjs document content
(previously `y-leveldb` on local disk) now lives in each organization's own
tenant database instead, via the `YjsUpdate` model and
`server/src/yjs/pgPersistence.ts`. See that file and `docStore.ts`'s header
comment for the full rationale.

## Why a signed token for WS connections

The API (mints tokens) and the realtime WS server (verifies them) are
separate services on separate domains once deployed — a session cookie set
by the API doesn't reach the WS upgrade request the way it would if
everything were one process. `server/src/yjs/wsToken.ts` mints a short-lived
HMAC-signed token (`GET /api/documents/:id/yjs-token`, checked against real
document membership first) that the WS server verifies statelessly. Both
services need the **same** `YJS_TOKEN_SECRET`.

## 1. Deploy `web` to Vercel

- New Vercel project, **Root Directory: `web`**.
- `web/vercel.json` already sets the install/build commands (they `cd ..`
  to install from the repo root and build `packages/shared` first, since
  it's a workspace dependency).
- Environment variables (Vercel dashboard → Settings → Environment Variables):
  - `VITE_API_URL` — the deployed API's URL (from step 2 below).
  - `VITE_YJS_WS_URL` — the deployed realtime service's `wss://` URL (from step 3 below).

## 2. Deploy `api` to Vercel

- A **second, separate** Vercel project, **Root Directory: `server`**.
- `server/vercel.json` sets the install/build commands. Vercel auto-detects
  `server/server.ts` (it calls `.listen()`) and captures it as a Vercel
  Function — see [Vercel's Node.js server docs](https://vercel.com/docs/functions/runtimes/node-js#deploy-a-node.js-server).
  No custom `functions`/rewrites config needed.
- Environment variables — see the list below. `WEB_ORIGIN` must be the
  deployed web app's real URL (CORS).
- **Known limitation**: Vercel Functions have a maximum execution duration
  (10s on Hobby, up to 300s+ on Pro with Fluid compute). Viki's agent runs
  stream over SSE and can genuinely take longer than the Hobby limit for
  complex, multi-iteration instructions — if you hit this, either upgrade
  to Pro or consider moving `/api/documents/:id/agent-runs` to the realtime
  service instead (not done here; flagging it as a real constraint, not a bug).

## 3. Deploy `realtime` to Render

- `render.yaml` at the repo root is a Render Blueprint — in the Render
  dashboard, "New Blueprint Instance" and point it at this repo, or create
  a Web Service manually with:
  - Build command: `npm ci && npm run build -w packages/shared && npm run build -w server`
  - Start command: `node server/dist/src/realtimeEntry.js`
  - Health check path: `/`
- Environment variables — see the list below.
- Render's free tier has **no persistent disk** and spins down after
  inactivity — this is exactly why live document content moved to Postgres
  (see above). No local-disk env var is needed for this service anymore.

## Environment variables needed

Ask whoever set up the original `.env` for the actual secret values — never
commit real secrets into this file or into `vercel.json`/`render.yaml`.

**Vercel `web` project:**
- `VITE_API_URL`, `VITE_YJS_WS_URL`

**Vercel `api` project:**
- `DATABASE_URL`, `DIRECT_URL` (Neon)
- `ANTHROPIC_API_KEY`, `VIKI_MODEL`
- `GEMINI_API_KEY`, `VIKI_GEMINI_MODEL` (optional — only if `VIKI_PROVIDER=gemini`)
- `OPENAI_API_KEY`, `VIKI_OPENAI_MODEL` (optional — only if `VIKI_PROVIDER=openai`)
- `VIKI_PROVIDER`
- `CREDENTIALS_ENCRYPTION_KEY`
- `YJS_TOKEN_SECRET`
- `WEB_ORIGIN` (the deployed web app's URL)

**Render `realtime` service:**
- `DATABASE_URL`, `DIRECT_URL` (Neon) — needed to resolve which org owns a document and its tenant DB
- `CREDENTIALS_ENCRYPTION_KEY` — must match the API's value exactly (decrypts org DB connection strings)
- `YJS_TOKEN_SECRET` — must match the API's value exactly (verifies connection tokens)
- `WORKER_MODE=external` (already set in `render.yaml`)

## Verifying a deployment

The same pattern used throughout this project's development: register a
test user via `POST /api/auth/register`, create a document, fetch a WS
token via `GET /api/documents/:id/yjs-token`, connect to the realtime
service with it, write some content, then confirm via
`POST /api/documents/:id/versions` + `GET .../versions/:id/text` that the
API service (a different process) can read back what the realtime service
persisted. This exact flow — including a real bug it caught (an async race
in `docStore.ts` that produced empty version snapshots for a document the
API process had never touched before) — is documented in the commit history.
