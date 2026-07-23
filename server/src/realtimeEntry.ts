import "./loadEnv.js";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { attachYjsWebSocket } from "./yjs/wsServer.js";
import { startWorkers, stopQueue } from "./jobs/queue.js";

/**
 * RENDER entrypoint: the Yjs realtime WS server + the background job queue
 * worker, run together in ONE process — everything a persistent, always-on
 * process is required for, since the Express API (server/api/index.ts) runs
 * separately as Vercel serverless functions and can't host either of these
 * (see docStore.ts's header comment and this project's deploy notes for why).
 */

process.on("unhandledRejection", (reason) => {
  console.error("[realtime] unhandled rejection:", reason instanceof Error ? reason.message : reason);
});
process.on("uncaughtException", (err) => {
  console.error("[realtime] uncaught exception:", err.message);
});

// Render (like most PaaS hosts) assigns the externally-reachable port via
// $PORT — YJS_PORT is only a local-dev fallback for running this file directly.
const PORT = Number(process.env.PORT ?? process.env.YJS_PORT ?? 4001);

// A bare createServer() has no handler for plain (non-upgrade) HTTP
// requests — needed so Render's health check (a normal GET /) gets a 200
// instead of hanging. WS upgrades still work the same; they're handled via
// the 'upgrade' event on this same http.Server, not this request handler.
const yjsServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
});
const wss = new WebSocketServer({ server: yjsServer });
attachYjsWebSocket(wss);
yjsServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n[docket-realtime] Port ${PORT} is already in use.\n`);
  } else {
    console.error(`\n[docket-realtime] Cannot start on port ${PORT}:`, err.message, "\n");
  }
  process.exit(1);
});
yjsServer.listen(PORT, () => console.log(`[docket-realtime] Yjs WS on port ${PORT}`));

void startWorkers().catch((err) => console.error("[queue] failed to start workers:", (err as Error).message));

async function shutdown(): Promise<void> {
  await stopQueue().catch(() => undefined);
  yjsServer.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
