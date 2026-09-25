import { loadConfig } from "@/config/config";
import { runFetch } from "@/fetcher/run-fetch";
import { createLogger } from "@/log/logger";
import { checkDataDirWritable } from "@/storage/data-dir";

const log = createLogger("fetch-cli");

const config = loadConfig();
const dataDirCheck = await checkDataDirWritable(config.dataDir);
if (!dataDirCheck.ok) {
  log.error("data dir not writable", undefined, {
    reason: dataDirCheck.message,
  });
  process.exit(1);
}
const result = await runFetch(config);
if (!result.ok) {
  log.error("manual fetch failed", undefined, { reason: result.message });
  process.exit(1);
}
log.info("manual fetch succeeded");
process.exit(0);
