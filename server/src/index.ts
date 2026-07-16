import "./loadEnv.js";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { attachUser } from "./auth/session.js";
import { attachYjsWebSocket } from "./yjs/wsServer.js";
import { authRouter } from "./routes/auth.js";
import { documentsRouter } from "./routes/documents.js";
import { proposalsRouter } from "./routes/proposals.js";
import { agentRunsRouter } from "./routes/agentRuns.js";
import { versionsRouter } from "./routes/versions.js";
import { auditRouter } from "./routes/audit.js";
import { templatesRouter } from "./routes/templates.js";
import { exportRouter } from "./routes/export.js";
import { intakeRouter } from "./routes/intake.js";
import { usageRouter } from "./routes/usage.js";

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

const app = express();
app.use(
  cors({
    origin: process.env.WEB_ORIGIN ?? true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(attachUser);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/documents", documentsRouter);
app.use("/api", proposalsRouter);
app.use("/api", agentRunsRouter);
app.use("/api", versionsRouter);
app.use("/api", auditRouter);
app.use("/api", templatesRouter);
app.use("/api", exportRouter);
app.use("/api", intakeRouter);
app.use("/api", usageRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Never log document contents — only the message.
  console.error("[api] error:", err.message);
  res.status(500).json({ error: err.message });
});

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
