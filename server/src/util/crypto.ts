import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * At-rest encryption for Organization-level secrets (each org's own Anthropic
 * API key, each org's own Neon database connection string). AES-256-GCM with
 * a per-value random IV; ciphertext layout is [iv(12) | authTag(16) | data].
 */

let cachedKey: Buffer | null | undefined;

function key(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    cachedKey = null;
    return null;
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded).");
  }
  cachedKey = buf;
  return cachedKey;
}

export function isEncryptionConfigured(): boolean {
  return key() !== null;
}

export function encryptSecret(plaintext: string): string {
  const k = key();
  if (!k) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set — cannot store organization secrets.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const k = key();
  if (!k) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set — cannot read organization secrets.");
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", k, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Last 4 chars only — safe to show in an admin UI so they can recognize which key/URL is set without re-exposing it. */
export function maskSecretHint(plaintext: string): string {
  const tail = plaintext.slice(-4);
  return `••••••••${tail}`;
}
