import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
import { createId } from "../util/id.js";
import { createSession, getSession, subscribeIntake, emitIntake } from "../agent/intakeManager.js";
import { runIntakeTurn, GREETING } from "../agent/intake.js";
import type { IntakeMessageRequest, IntakeStartResponse } from "@docket/shared";

export const intakeRouter = Router();
intakeRouter.use(requireAuth);

// Start a chat intake session. Viki's opening greeting is canned (no model call).
intakeRouter.post("/intake", (req: AuthedRequest, res) => {
  const sessionId = createId("intake");
  const session = createSession(sessionId, req.user!.id, req.user!.name);
  session.history.push({ role: "assistant", content: GREETING });
  const body: IntakeStartResponse = { sessionId, greeting: GREETING };
  return res.json(body);
});

// SSE stream of intake events.
intakeRouter.get("/intake/:id/stream", (req: AuthedRequest, res) => {
  const session = getSession(req.params.id!);
  if (!session || session.userId !== req.user!.id) return res.status(404).json({ error: "Session not found" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  const unsub = subscribeIntake(req.params.id!, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
  const keepAlive = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    clearInterval(keepAlive);
    unsub();
  });
  return undefined;
});

// Send a user message; Viki responds asynchronously over the SSE stream.
intakeRouter.post("/intake/:id/message", (req: AuthedRequest, res) => {
  const session = getSession(req.params.id!);
  if (!session || session.userId !== req.user!.id) return res.status(404).json({ error: "Session not found" });
  const { message } = (req.body ?? {}) as IntakeMessageRequest;
  if (!message || !message.trim()) return res.status(400).json({ error: "message required" });
  if (session.busy) return res.status(409).json({ error: "Viki is still responding" });

  session.history.push({ role: "user", content: message });
  emitIntake(req.params.id!, { type: "state", state: "thinking" });
  void runIntakeTurn(session);
  return res.json({ ok: true });
});
