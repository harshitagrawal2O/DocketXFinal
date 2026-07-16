import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth/session.js";
import { requireCap } from "../auth/roles.js";
import { requireLLM } from "../llm/availability.js";
import { createId } from "../util/id.js";
import { createRun, getRun, subscribe, stopRun } from "../agent/runManager.js";
import { runAgent } from "../agent/runner.js";
import type { StartAgentRunRequest } from "@docket/shared";

export const agentRunsRouter = Router();

// Start a run (run_agent capability).
agentRunsRouter.post(
  "/documents/:id/agent-runs",
  requireAuth,
  requireLLM,
  requireCap("run_agent"),
  async (req: AuthedRequest, res) => {
    const body = req.body as StartAgentRunRequest;
    if (!body?.instruction) return res.status(400).json({ error: "instruction required" });

    // Resume path: answering a clarifying question.
    if (body.resumeRunId) {
      const existing = getRun(body.resumeRunId);
      if (!existing) return res.status(404).json({ error: "Run not found or expired" });
      existing.history.push({ role: "user", content: body.answer ?? body.instruction });
      void runAgent(existing);
      return res.json({ agentRunId: existing.runId });
    }

    const runId = createId("run");
    await prisma.auditEvent.create({
      data: { documentId: req.params.id!, type: "agent_run_started", userId: req.user!.id, userName: req.user!.name, agentRunId: runId, detail: { scope: body.scope } },
    });

    const run = createRun({
      runId,
      documentId: req.params.id!,
      userId: req.user!.id,
      userName: req.user!.name,
      history: [],
      instruction: body.instruction,
      scope: body.scope,
      selection: body.selectionAnchors,
    });

    void runAgent(run);
    return res.json({ agentRunId: runId });
  },
);

// SSE stream for a run.
agentRunsRouter.get("/agent-runs/:runId/stream", requireAuth, (req: AuthedRequest, res) => {
  const run = getRun(req.params.runId!);
  if (!run) return res.status(404).json({ error: "Run not found or expired" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  const unsub = subscribe(req.params.runId!, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.type === "run_complete" || event.type === "run_interrupted" || event.type === "error") {
      res.end();
    }
  });

  const keepAlive = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    clearInterval(keepAlive);
    unsub();
  });
  return undefined;
});

// Stop / interrupt a run.
agentRunsRouter.post("/agent-runs/:runId/stop", requireAuth, (req: AuthedRequest, res) => {
  const ok = stopRun(req.params.runId!);
  return res.status(ok ? 200 : 404).json({ ok });
});
