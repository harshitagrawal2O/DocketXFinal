import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "./util/crypto.js";

/**
 * One PrismaClient instance per DISTINCT resolved database URL — cached by
 * URL, not by organizationId. Most organizations haven't set their own
 * dedicated database and all fall back to the platform's own DATABASE_URL
 * (see resolveDatabaseUrl below); keying by orgId would give each of those
 * organizations its own separate PrismaClient, and therefore its own
 * separate connection pool, all pointed at the SAME Neon endpoint — under
 * any real number of organizations this exhausts Neon's connection limit
 * (observed directly: "Can't reach database server" mid-test, after
 * creating enough test organizations that each opened its own pool to the
 * one shared database). Keying by URL means every org sharing that default
 * naturally shares one pool, exactly like a single-tenant app would.
 *
 * Organizations that DO set their own Neon connection string (the
 * `datasourceUrl` constructor override — see schema.prisma's header comment
 * for why this is safe with one shared schema) get their own cache entry
 * and therefore their own genuinely separate connection pool, which is the
 * actual point of "separate database per organization."
 */

interface CacheEntry {
  client: PrismaClient;
  lastUsed: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHED_CLIENTS = 25;
const IDLE_EVICT_MS = 15 * 60 * 1000;

export interface TenantOrg {
  id: string;
  databaseUrlEnc: string | null;
}

function resolveDatabaseUrl(org: TenantOrg): string {
  if (!org.databaseUrlEnc) {
    // Bootstrap/default organization: no dedicated database set yet, so its
    // tenant data lives on the platform's own DATABASE_URL.
    const fallback = process.env.DATABASE_URL;
    if (!fallback) throw new Error("No database configured for this organization and no platform default is set.");
    return fallback;
  }
  return decryptSecret(org.databaseUrlEnc);
}

function evictIfNeeded(): void {
  const now = Date.now();
  for (const [url, entry] of cache) {
    if (now - entry.lastUsed > IDLE_EVICT_MS) {
      void entry.client.$disconnect();
      cache.delete(url);
    }
  }
  if (cache.size <= MAX_CACHED_CLIENTS) return;
  const byAge = [...cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  const excess = cache.size - MAX_CACHED_CLIENTS;
  for (let i = 0; i < excess; i++) {
    const [url, entry] = byAge[i]!;
    void entry.client.$disconnect();
    cache.delete(url);
  }
}

export function getTenantClient(org: TenantOrg): PrismaClient {
  const url = resolveDatabaseUrl(org);
  const existing = cache.get(url);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.client;
  }
  const client = new PrismaClient({ datasourceUrl: url });
  cache.set(url, { client, lastUsed: Date.now() });
  evictIfNeeded();
  return client;
}

/** Open a ONE-OFF client against an arbitrary connection string — used to validate/migrate a new DB before it's saved on the Organization row. */
export function openAdHocClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ datasourceUrl: databaseUrl });
}
