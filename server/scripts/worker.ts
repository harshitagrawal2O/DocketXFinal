import "../src/loadEnv.js";
import { startWorkers, stopQueue } from "../src/jobs/queue.js";

/**
 * Standalone worker process (§2a). Run this instead of in-process workers when
 * scaling horizontally: set WORKER_MODE=external on the web tier and run
 *   tsx server/scripts/worker.ts   (under PM2 or similar)
 */
async function main(): Promise<void> {
  await startWorkers();
  console.log("[worker] running; press Ctrl+C to stop");
}

const shutdown = async () => {
  await stopQueue();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
