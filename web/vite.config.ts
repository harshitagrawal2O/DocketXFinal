import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";

const sharedDir = fileURLToPath(new URL("../packages/shared", import.meta.url));

/**
 * The shared package is authored with NodeNext-style `.js` import specifiers
 * that physically resolve to `.ts` source (e.g. `export * from "./roles.js"`).
 * Vite doesn't remap those by default, so we do it for imports originating
 * inside packages/shared. TypeScript already understands this via "Bundler"
 * module resolution — this only bridges the runtime bundler.
 */
function sharedJsToTs(): Plugin {
  return {
    name: "docket-shared-js-to-ts",
    enforce: "pre",
    resolveId(source, importer) {
      if (
        importer &&
        source.startsWith(".") &&
        source.endsWith(".js") &&
        importer.replace(/\\/g, "/").includes("packages/shared")
      ) {
        const candidate = resolvePath(dirname(importer), source.replace(/\.js$/, ".ts"));
        if (existsSync(candidate)) return candidate;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [sharedJsToTs(), react()],
  resolve: {
    alias: {
      "@docket/shared": resolvePath(sharedDir, "src/index.ts"),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    // Yjs / y-prosemirror MUST be single instances or CRDT state desyncs.
    dedupe: ["yjs", "y-prosemirror", "@tiptap/pm", "react", "react-dom"],
  },
  optimizeDeps: {
    include: ["yjs", "y-prosemirror", "y-websocket"],
  },
  server: {
    port: 5173,
  },
});
