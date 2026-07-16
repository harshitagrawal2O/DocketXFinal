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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Never log document contents — only the message.
  console.error("[api] error:", err.message);
  res.status(500).json({ error: err.message });
});

const httpServer = createServer(app);
httpServer.listen(PORT, () => console.log(`[docket] API on http://localhost:${PORT}`));

// Yjs realtime on a dedicated port (per-doc rooms via path).
const yjsServer = createServer();
const wss = new WebSocketServer({ server: yjsServer });
attachYjsWebSocket(wss);
yjsServer.listen(YJS_PORT, () => console.log(`[docket] Yjs WS on ws://localhost:${YJS_PORT}`));
