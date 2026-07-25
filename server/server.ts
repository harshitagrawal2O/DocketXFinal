import "./src/loadEnv.js";
import { app } from "./src/app.js";

/**
 * Vercel entrypoint: export the Express app as the function handler.
 * Local dev still uses src/index.ts, which starts the API, Yjs WS server, and
 * worker together. Vercel should run only the API app; the realtime service
 * lives on Render via src/realtimeEntry.ts.
 */
export default app;
