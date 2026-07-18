import PgBoss from "pg-boss";
import { prisma } from "../db.js";
import { getTenantClient } from "../tenantDb.js";
import { getTemplate, generateDocumentFromHtml, renderTitle } from "../templates/service.js";
import { personalizeDocument } from "../agent/templateAgent.js";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Durable, Postgres-backed job queue (§2a). Heavy fan-out — a batch of
 * case-personalised documents, each an LLM call — runs here instead of inline,
 * so it survives restarts, retries on failure, and is concurrency-bounded
 * (the LLM limiter caps parallel model calls regardless of worker count).
 *
 * Runs in-process by default (startWorkers from index.ts). For horizontal
 * scale, run scripts/worker.ts as a separate process and set WORKER_MODE=external.
 *
 * Jobs carry `organizationId`, not a live tenant PrismaClient — a client
 * instance can't survive serialization into the durable queue (or a restart
 * between enqueue and execution). Each handler resolves the org's tenant
 * client fresh via getTenantClient when the job actually runs.
 */

const QUEUE_BATCH_ITEM = "batch-generate-item";

let boss: PgBoss | null = null;

async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL required for the job queue");
  boss = new PgBoss({ connectionString, max: 5 });
  boss.on("error", (err) => console.error("[queue] pg-boss error:", err.message));
  await boss.start();
  await boss.createQueue(QUEUE_BATCH_ITEM);
  return boss;
}

interface JobOwner {
  id: string;
  name: string;
  email: string;
  color: string;
}

export interface BatchItemJob {
  batchId: string;
  organizationId: string;
  templateId: string;
  documentTitle: string;
  brief: string;
  owner: JobOwner;
}

async function tenantDbForOrg(organizationId: string): Promise<PrismaClient> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  return getTenantClient({ id: org.id, databaseUrlEnc: org.databaseUrlEnc });
}

/** Create a Batch row and enqueue one job per row. Returns the batchId. */
export async function enqueueBriefBatch(params: {
  templateId: string;
  titlePattern: string;
  briefs: string[];
  organizationId: string;
  owner: JobOwner;
}): Promise<string> {
  const b = await getBoss();
  const tenantDb = await tenantDbForOrg(params.organizationId);
  const batch = await tenantDb.batch.create({
    data: {
      ownerId: params.owner.id,
      templateId: params.templateId,
      titlePattern: params.titlePattern,
      total: params.briefs.length,
    },
  });

  for (const brief of params.briefs) {
    const documentTitle = renderTitle(params.titlePattern, { brief });
    const job: BatchItemJob = {
      batchId: batch.id,
      organizationId: params.organizationId,
      templateId: params.templateId,
      documentTitle,
      brief,
      owner: params.owner,
    };
    await b.send(QUEUE_BATCH_ITEM, job, { retryLimit: 2, retryDelay: 5 });
  }
  return batch.id;
}

async function handleBatchItem(job: BatchItemJob): Promise<void> {
  const tenantDb = await tenantDbForOrg(job.organizationId);
  const template = await getTemplate(tenantDb, job.templateId, job.owner.id);
  if (!template) throw new Error(`Template ${job.templateId} not found`);
  const personalized = await personalizeDocument(
    { tenantDb, organizationId: job.organizationId, userId: job.owner.id },
    template,
    job.brief,
  );
  const documentId = await generateDocumentFromHtml(
    tenantDb,
    personalized.bodyHtml,
    job.documentTitle,
    template.kind,
    template.id,
    job.owner,
    personalized.personalizationNotes,
  );
  const current = await tenantDb.batch.findUnique({ where: { id: job.batchId } });
  const ids = ((current?.documentIds as string[]) ?? []).concat(documentId);
  const done = (current?.done ?? 0) + 1;
  await tenantDb.batch.update({
    where: { id: job.batchId },
    data: {
      done,
      documentIds: ids as unknown as Prisma.InputJsonValue,
      status: done + (current?.failed ?? 0) >= (current?.total ?? 0) ? "complete" : "running",
    },
  });
}

async function recordBatchFailure(organizationId: string, batchId: string, message: string): Promise<void> {
  const tenantDb = await tenantDbForOrg(organizationId);
  const current = await tenantDb.batch.findUnique({ where: { id: batchId } });
  if (!current) return;
  const errors = ((current.errors as string[]) ?? []).concat(message);
  const failed = current.failed + 1;
  await tenantDb.batch.update({
    where: { id: batchId },
    data: {
      failed,
      errors: errors as unknown as Prisma.InputJsonValue,
      status: current.done + failed >= current.total ? (current.done > 0 ? "complete" : "failed") : "running",
    },
  });
}

/** Register queue workers in this process. */
export async function startWorkers(): Promise<void> {
  const b = await getBoss();
  await b.work<BatchItemJob>(QUEUE_BATCH_ITEM, { batchSize: 2 }, async ([job]) => {
    if (!job) return;
    try {
      await handleBatchItem(job.data);
    } catch (err) {
      // Never log document content — only the message.
      console.error("[queue] batch item failed:", (err as Error).message);
      await recordBatchFailure(job.data.organizationId, job.data.batchId, (err as Error).message);
      throw err; // let pg-boss apply retry policy
    }
  });
  console.log("[queue] workers started");
}

export async function stopQueue(): Promise<void> {
  if (boss) await boss.stop();
}
