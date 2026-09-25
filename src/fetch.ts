import { loadConfig } from "@/config/config";
import { runFetch } from "@/fetcher/run-fetch";
import { createLogger } from "@/log/logger";

const log = createLogger("fetch-cli");

const result = await runFetch(loadConfig());
if (!result.ok) {
  log.error("manual fetch failed", undefined, { reason: result.message });
  process.exit(1);
}
log.info("manual fetch succeeded");
process.exit(0);
