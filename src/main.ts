import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { loadConfig } from "@/config/config";
import { createLogger } from "@/log/logger";
import { startScheduler } from "@/scheduler/scheduler";
import { createApp } from "@/server/app";
import { checkDataDirWritable } from "@/storage/data-dir";

const log = createLogger("main");

// The bundle runs as dist/main.js and the frontend build lives next to it in dist/web.
const WEB_DIR = fileURLToPath(new URL("./web", import.meta.url));
// Open video streams can keep the server from closing; Docker kills the container after 10 s anyway.
const SHUTDOWN_TIMEOUT_MS = 8_000;

const config = loadConfig();
const dataDirCheck = await checkDataDirWritable(config.dataDir);
if (!dataDirCheck.ok) {
  log.error("data dir not writable", undefined, {
    reason: dataDirCheck.message,
  });
  process.exit(1);
}
const app = createApp({ config, webDir: WEB_DIR });
const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  log.info("server listening", { port: info.port, dataDir: config.dataDir });
});
const scheduler = startScheduler(config);

const shutdown = (signal: NodeJS.Signals) => {
  log.info("shutting down", { signal });
  scheduler.stop();
  setTimeout(() => process.exit(0), SHUTDOWN_TIMEOUT_MS).unref();
  server.close((err) => {
    if (err) log.error("server close failed", err);
    process.exit(err ? 1 : 0);
  });
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
