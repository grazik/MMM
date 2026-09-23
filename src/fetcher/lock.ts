import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getTmpDir } from "@/storage/paths";
import {
  LOCK_FILE_NAME,
  LOCK_STALE_AFTER_MS,
} from "./constants/fetcher.constants";

const LOCK_CONTENT_SCHEMA = z.object({
  pid: z.number().int().positive(),
});

export type ReleaseLock = () => Promise<void>;

export const getLockPath = (dataDir: string) =>
  path.join(getTmpDir(dataDir), LOCK_FILE_NAME);

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but belongs to another user.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
};

// Callers never reach this while holding the lock in this process (see runFetch),
// so a lock carrying our own pid is left over from a previous container run that reused it.
const isLockStale = async (lockPath: string, now: number): Promise<boolean> => {
  try {
    const stats = await fs.stat(lockPath);
    if (now - stats.mtimeMs > LOCK_STALE_AFTER_MS) return true;
    const parsed = LOCK_CONTENT_SCHEMA.safeParse(
      JSON.parse(await fs.readFile(lockPath, "utf8")),
    );
    if (!parsed.success) return false;
    if (parsed.data.pid === process.pid) return true;
    return !isProcessAlive(parsed.data.pid);
  } catch {
    // Unreadable or half-written lock: another process may be creating it right now.
    return false;
  }
};

const tryCreateLock = async (lockPath: string): Promise<boolean> => {
  try {
    await fs.writeFile(lockPath, JSON.stringify({ pid: process.pid }), {
      flag: "wx",
    });
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw err;
  }
};

// Cross-process single-flight: the CLI may run inside the container while the scheduler does.
export const acquireLock = async (
  dataDir: string,
  now: number = Date.now(),
): Promise<ReleaseLock | null> => {
  const lockPath = getLockPath(dataDir);
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  const release: ReleaseLock = async () => {
    await fs.rm(lockPath, { force: true });
  };
  if (await tryCreateLock(lockPath)) return release;
  if (!(await isLockStale(lockPath, now))) return null;
  await fs.rm(lockPath, { force: true });
  return (await tryCreateLock(lockPath)) ? release : null;
};
