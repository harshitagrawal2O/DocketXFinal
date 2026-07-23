import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived signed token authorizing one WS connection to one document.
 * Needed because the API (Vercel) and the realtime WS server (Render) are
 * separate services on separate domains — session cookies set by the API
 * (SameSite, and simply a different origin) don't reach the WS server's
 * upgrade request the way they would if everything were one process. The
 * API mints this after checking real document membership; the WS server
 * verifies the signature (stateless, no DB round-trip) and trusts the
 * embedded organizationId to resolve which tenant database to use.
 *
 * Both sides need the SAME YJS_TOKEN_SECRET set.
 */

const TOKEN_TTL_MS = 5 * 60 * 1000; // only needed at connection time, not for the life of the session

export interface WsTokenPayload {
  documentId: string;
  organizationId: string;
  userId: string;
  exp: number;
}

function secret(): string {
  const s = process.env.YJS_TOKEN_SECRET;
  if (!s) throw new Error("YJS_TOKEN_SECRET is not set");
  return s;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function mintWsToken(payload: Omit<WsTokenPayload, "exp">): string {
  const full: WsTokenPayload = { ...payload, exp: Date.now() + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyWsToken(token: string): WsTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as WsTokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
