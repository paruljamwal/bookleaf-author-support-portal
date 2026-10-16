import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { connectDatabase } from "./db/connect.js";
import { logger, logConfigHint } from "./lib/logger.js";

const env = getEnv();
await connectDatabase();
logConfigHint();
const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info("api listening", { port: env.PORT });
});
// Node's HTTP client keeps a socket briefly after the response. Closing it here first
// surfaces as ECONNRESET, which the Vite proxy reports as an empty text/plain 500.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
