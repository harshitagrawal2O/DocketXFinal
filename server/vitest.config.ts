import { defineConfig } from "vitest/config";

/**
 * Vitest config for the server package.
 *
 * These are the correctness-critical staging tests behind the phase gates
 * (claude.md: "The accept/reject/edit mutation path must have unit tests").
 * They exercise the Yjs anchoring + mutation layer with real Y.Doc instances,
 * so a plain Node environment is all we need — no DOM, no jsdom.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
