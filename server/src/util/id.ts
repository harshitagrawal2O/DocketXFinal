import { randomUUID } from "node:crypto";

/** Stable unique id for proposals/runs. Prefixed for readability in logs. */
export function createId(prefix = "p"): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}
