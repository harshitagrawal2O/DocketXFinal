import type { Request, Response, NextFunction } from "express";

/**
 * Fixed-window rate limiter (in-memory). Protects auth (brute force) and LLM
 * endpoints (cost abuse). NOTE: in-memory = per-instance; for multi-instance
 * production, back this with Redis or a shared store. Flagged in the
 * production-readiness checklist.
 */
interface Window {
  count: number;
  resetAt: number;
}

function keyOf(req: Request, bucket: string): string {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const user = req.header("x-user-id") || "";
  return `${bucket}:${ip}:${user}`;
}

export function rateLimit(opts: { bucket: string; max: number; windowMs: number }) {
  const windows = new Map<string, Window>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = keyOf(req, opts.bucket);
    let w = windows.get(key);
    if (!w || now > w.resetAt) {
      w = { count: 0, resetAt: now + opts.windowMs };
      windows.set(key, w);
    }
    w.count++;
    if (w.count > opts.max) {
      const retryAfter = Math.ceil((w.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: `Too many requests. Try again in ${retryAfter}s.`, code: "rate_limited" });
      return;
    }
    // Opportunistic cleanup so the map doesn't grow unbounded.
    if (windows.size > 5000) {
      for (const [k, v] of windows) if (now > v.resetAt) windows.delete(k);
    }
    next();
  };
}
