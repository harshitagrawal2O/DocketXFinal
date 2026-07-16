import PgBoss from "pg-boss";
import { prisma } from "../db.js";
import { getTemplate, generateDocumentFromHtml, renderTitle } from "../templates/service.js";
import { personalizeDocument } from "../agent/templateAgent.js";
import type { Prisma } from "@prisma/client";

/**
 * Durable, Postgres-backed job queue (§2a). Heavy fan-out — a batch of
 * case-personalised documents, each an LLM call — runs here instead of inline,
 * so it survives restarts, retries on failure, and is concurrency-bounded
 * (the LLM limiter caps parallel model calls regardless of worker count).
 *
 * Runs in-process by default (startWorkers from index.ts). For horizontal
 * scale, run scripts/worker.ts as a separate process and set WORKER_MODE=external.
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

export interface BatchItemJob {
  batchId: string;
  templateId: string;
  documentTitle: string;
  brief: string;
  ownerId: string;
  ownerName: string;
}

/** Create a Batch row and enqueue one job per row. Returns the batchId. */
export async function enqueueBriefBatch(params: {
  templateId: string;
  titlePattern: string;
  briefs: string[];
  ownerId: string;
  ownerName: string;
}): Promise<string> {
  const b = await getBoss();
  const batch = await prisma.batch.create({
    data: {
      ownerId: params.ownerId,
      templateId: params.templateId,
      titlePattern: params.titlePattern,
      total: params.briefs.length,
    },
  });

  for (const brief of params.briefs) {
    const documentTitle = renderTitle(params.titlePattern, { brief });
    const job: BatchItemJob = {
      batchId: batch.id,
      templateId: params.templateId,
      documentTitle,
      brief,
      ownerId: params.ownerId,
      ownerName: params.ownerName,
    };
    await b.send(QUEUE_BATCH_ITEM, job, { retryLimit: 2, retryDelay: 5 });
  }
  return batch.id;
}

async function handleBatchItem(job: BatchItemJob): Promise<void> {
  const template = await getTemplate(job.templateId, job.ownerId);
  if (!template) throw new Error(`Template ${job.templateId} not found`);
  const personalized = await personalizeDocument(template, job.brief, job.ownerId);
  const documentId = await generateDocumentFromHtml(
    personalized.bodyHtml,
    job.documentTitle,
    template.kind,
    template.id,
    job.ownerId,
    job.ownerName,
    personalized.personalizationNotes,
  );
  const current = await prisma.batch.findUnique({ where: { id: job.batchId } });
  const ids = ((current?.documentIds as string[]) ?? []).concat(documentId);
  const done = (current?.done ?? 0) + 1;
  await prisma.batch.update({
    where: { id: job.batchId },
    data: {
      done,
      documentIds: ids as unknown as Prisma.InputJsonValue,
      status: done + (current?.failed ?? 0) >= (current?.total ?? 0) ? "complete" : "running",
    },
  });
}

async function recordBatchFailure(batchId: string, message: string): Promise<void> {
  const current = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!current) return;
  const errors = ((current.errors as string[]) ?? []).concat(message);
  const failed = current.failed + 1;
  await prisma.batch.update({
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
      await recordBatchFailure(job.data.batchId, (err as Error).message);
      throw err; // let pg-boss apply retry policy
    }
  });
  console.log("[queue] workers started");
}

export async function stopQueue(): Promise<void> {
  if (boss) await boss.stop();
}
