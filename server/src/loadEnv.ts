import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Load the repo-root .env regardless of the process working directory.
 *
 * npm workspace scripts run with cwd = the workspace dir (server/), so a plain
 * `dotenv/config` would look for server/.env and miss the single root .env.
 * We try several candidate locations relative to BOTH this file and the cwd;
 * dotenv does not override already-set vars, so loading several is safe and the
 * first hit for each key wins. Import this before anything reads process.env
 * (PrismaClient reads DATABASE_URL at construction).
 */
const here = dirname(fileURLToPath(import.meta.url));

const candidates = [
  resolve(here, "../../.env"), // dev: server/src -> root
  resolve(here, "../../../.env"), // build: server/dist/src -> root
  resolve(process.cwd(), ".env"), // run from repo root
  resolve(process.cwd(), "../.env"), // run from a workspace dir
];

for (const path of candidates) {
  config({ path });
}
