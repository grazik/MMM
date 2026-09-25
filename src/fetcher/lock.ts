import fs from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";
import { createLogger } from "@/log/logger";
import { getTmpDir } from "@/storage/paths";
import {
  LOCK_FILE_NAME,
  LOCK_STALE_AFTER_MS,
} from "./constants/fetcher.constants";

export type ReleaseLock = () => Promise<void>;

const log = createLogger("fetcher");

export const getLockPath = (dataDir: string) =>
  path.join(getTmpDir(dataDir), LOCK_FILE_NAME);

// Cross-process single-flight: the CLI may run inside the container while the scheduler does.
// The holder refreshes the lock's mtime, so a crashed holder's lock turns stale within LOCK_STALE_AFTER_MS.
export const acquireLock = async (
  dataDir: string,
): Promise<ReleaseLock | null> => {
  const tmpDir = getTmpDir(dataDir);
  await fs.mkdir(tmpDir, { recursive: true });
  try {
    const release = await lockfile.lock(tmpDir, {
      lockfilePath: getLockPath(dataDir),
      stale: LOCK_STALE_AFTER_MS,
      // The default throws from a timer, which would crash the server; the run in flight still finishes.
      onCompromised: (err) => log.error("fetch lock compromised", err),
    });
    return async () => {
      try {
        await release();
      } catch (err) {
        // A compromised lock is already gone; failing here would turn a published set into a failed run.
        log.warn("fetch lock release failed", { reason: String(err) });
      }
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ELOCKED") return null;
    throw err;
  }
};
