import express from "express";
import cors from "cors";
import { attachUser } from "./auth/session.js";
import { attachOrg } from "./auth/org.js";
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
import { adminRouter } from "./routes/admin.js";

/**
 * The Express app, decoupled from HOW it's served — imported directly by
 * server/src/index.ts (local dev: one process runs this + the Yjs WS server
 * + the queue worker together) and by server/api/index.ts (Vercel: this
 * app alone, as a serverless function; the Yjs WS server + worker run
 * separately on Render via realtimeEntry.ts — see docs on why a WebSocket
 * server can't run as a Vercel serverless function).
 */
export const app = express();

app.use(
  cors({
    origin: process.env.WEB_ORIGIN ?? true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(attachUser);
app.use(attachOrg);

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
app.use("/api", adminRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Never log document contents — only the message.
  console.error("[api] error:", err.message);
  res.status(500).json({ error: err.message });
});
