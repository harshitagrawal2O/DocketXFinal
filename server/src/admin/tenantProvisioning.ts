import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { openAdHocClient } from "../tenantDb.js";
import { BUILTIN_TEMPLATES } from "../templates/builtin.js";
import type { Prisma } from "@prisma/client";

const execFileAsync = promisify(execFile);

// server/src/admin/ -> server/ (two levels up) is the package root that owns
// prisma/schema.prisma and node_modules/.bin/prisma, regardless of whether
// this runs from source (src/admin) or compiled (dist/src/admin).
const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Connectivity check for a candidate org database connection string before we touch anything else. */
export async function testConnection(databaseUrl: string): Promise<void> {
  const client = openAdHocClient(databaseUrl);
  try {
    await client.$queryRaw`SELECT 1`;
  } finally {
    await client.$disconnect();
  }
}

/**
 * Apply this project's full migration history to a NEW organization's own
 * database, using the SAME schema.prisma as the platform's control-plane DB
 * (see schema.prisma's header comment — one schema, multiple physical
 * databases). This also creates User/Organization/Session tables in the
 * org's database; they go unused there (the org's own tenant client never
 * queries them) — a small cosmetic cost for reusing 100% of the existing,
 * already-tested migration tooling instead of maintaining a second schema.
 */
export async function runTenantMigrations(databaseUrl: string): Promise<void> {
  const prismaBin = process.platform === "win32" ? "prisma.cmd" : "prisma";
  const binPath = resolve(SERVER_ROOT, "..", "node_modules", ".bin", prismaBin);
  await execFileAsync(binPath, ["migrate", "deploy"], {
    cwd: SERVER_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    timeout: 120_000,
  });
}

/** Seed the standard builtin template library into a freshly-migrated org database. */
export async function seedBuiltinTemplates(databaseUrl: string): Promise<void> {
  const client = openAdHocClient(databaseUrl);
  try {
    for (const t of BUILTIN_TEMPLATES) {
      await client.template.upsert({
        where: { id: t.id },
        update: {},
        create: {
          id: t.id,
          ownerId: null,
          source: "builtin",
          title: t.title,
          category: t.category,
          kind: t.kind,
          description: t.description,
          bodyHtml: t.bodyHtml,
          variables: t.variables as unknown as Prisma.InputJsonValue,
        },
      });
    }
  } finally {
    await client.$disconnect();
  }
}

/** Full provisioning flow for "the admin sets a new database for their org." Throws with a clear message on any failure — nothing is saved by the caller until this resolves. */
export async function provisionTenantDatabase(databaseUrl: string): Promise<void> {
  await testConnection(databaseUrl);
  await runTenantMigrations(databaseUrl);
  await seedBuiltinTemplates(databaseUrl);
}
