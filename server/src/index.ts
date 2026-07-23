import "./loadEnv.js";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { app } from "./app.js";
import { attachYjsWebSocket } from "./yjs/wsServer.js";

/**
 * LOCAL DEV entrypoint only: runs the Express API, the Yjs WS server, and
 * the queue worker together in one process, exactly as before. In a real
 * deployment these three run separately — see server/api/index.ts (Vercel,
 * API only) and server/src/realtimeEntry.ts (Render, Yjs WS + worker).
 */

// Backstop: Express 4 does not forward a rejected promise from an async
// middleware/handler to the error middleware — an uncaught rejection would
// otherwise crash the ENTIRE process (all connected users, all WS/SSE
// streams) on any transient error (e.g. a serverless Postgres cold start).
// Route handlers should still catch their own errors; this is the last line
// of defense so one bad request degrades to a failed response, not an outage.
process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandled rejection:", reason instanceof Error ? reason.message : reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaught exception:", err.message);
});

const PORT = Number(process.env.PORT ?? 4000);
const YJS_PORT = Number(process.env.YJS_PORT ?? 4001);

/**
 * A failure to LISTEN (e.g. EADDRINUSE — something else already on this port)
 * is a fatal startup condition, not a transient runtime error. It must NOT be
 * swallowed by the process-level unhandledRejection/uncaughtException backstop
 * above (that backstop exists for request-handling errors, so one bad request
 * doesn't take down the server for everyone else) — here we want a loud, clear
 * failure so whoever is running `npm run dev` immediately sees why nothing
 * came up, instead of a half-started server that never actually bound.
 */
function reportListenFailure(label: string, port: number, err: NodeJS.ErrnoException): never {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n[docket] Cannot start ${label} — port ${port} is already in use.\n` +
        `Something else (maybe a leftover server from a previous run) is listening there.\n` +
        (process.platform === "win32"
          ? `Find it with:  Get-NetTCPConnection -LocalPort ${port} -State Listen | Select OwningProcess\n` +
            `Then stop it:  Stop-Process -Id <pid> -Force\n`
          : `Find it with:  lsof -i :${port}\nThen stop it:  kill <pid>\n`),
    );
  } else {
    console.error(`\n[docket] Cannot start ${label} on port ${port}:`, err.message, "\n");
  }
  process.exit(1);
}

const httpServer = createServer(app);
httpServer.on("error", (err: NodeJS.ErrnoException) => reportListenFailure("the API server", PORT, err));
httpServer.listen(PORT, () => console.log(`[docket] API on http://localhost:${PORT}`));

// Start queue workers in-process unless a standalone worker is used.
if (process.env.WORKER_MODE !== "external") {
  import("./jobs/queue.js")
    .then((m) => m.startWorkers())
    .catch((err) => console.error("[queue] failed to start workers:", (err as Error).message));
}

// Yjs realtime on a dedicated port (per-doc rooms via path).
const yjsServer = createServer();
const wss = new WebSocketServer({ server: yjsServer });
attachYjsWebSocket(wss);
yjsServer.on("error", (err: NodeJS.ErrnoException) => reportListenFailure("the Yjs WebSocket server", YJS_PORT, err));
yjsServer.listen(YJS_PORT, () => console.log(`[docket] Yjs WS on ws://localhost:${YJS_PORT}`));
