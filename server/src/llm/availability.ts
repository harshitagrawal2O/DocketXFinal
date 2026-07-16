import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "../auth/session.js";

/** Whether Viki (the Claude API) is configured. */
export function isLLMAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Graceful degradation (§4): AI features return a friendly 503 instead of
 * throwing when no API key is set. Everything else (editor, staging, seeded
 * proposals, templates, versions, audit) keeps working.
 */
export function requireLLM(_req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!isLLMAvailable()) {
    res.status(503).json({
      error: "Viki is not configured on this server (no ANTHROPIC_API_KEY). Document editing, templates, and review still work.",
      code: "llm_unavailable",
    });
    return;
  }
  next();
}
