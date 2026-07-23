import "./src/loadEnv.js";
import { app } from "./src/app.js";

/**
 * VERCEL entrypoint: Vercel auto-detects a `server.{js,ts}` file at the
 * project root that calls `.listen()` and captures it as a Vercel Function —
 * https://vercel.com/docs/functions/runtimes/node-js#deploy-a-node.js-server.
 * No custom Request/Response bridging needed: this is the SAME Express app
 * used locally, just without the Yjs WS server or queue worker attached (see
 * src/index.ts for local dev, src/realtimeEntry.ts for Render — neither can
 * run as a Vercel Function; see docStore.ts's header comment for why).
 *
 * The port below is only used when running this file directly for local
 * testing — Vercel ignores it and routes traffic to the captured server
 * through its own internal mechanism.
 */
const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => console.log(`[docket-api] listening on ${PORT}`));
