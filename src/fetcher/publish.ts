import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getSetDir, getSetsDir, getTmpDir } from "@/storage/paths";
import { LOCK_FILE_NAME } from "./constants/fetcher.constants";

const pathExists = async (target: string): Promise<boolean> => {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
};

const OLD_SET_PREFIX = "old-";
const OLD_SET_PATTERN = /^old-(\d{4}-\d{2}-\d{2})-/;

export type TmpCleanup = { removed: string[]; restored: string[] };

// A crash between publishSet's two renames leaves the served set only in tmp; put it back before wiping.
const restoreOrphanedSets = async (
  dataDir: string,
  leftovers: string[],
): Promise<string[]> => {
  const restored: string[] = [];
  // Sequential: two copies for one date must not both try to take its place.
  for (const name of leftovers) {
    const date = OLD_SET_PATTERN.exec(name)?.[1];
    if (!date) continue;
    const setDir = getSetDir(dataDir, date);
    if (await pathExists(setDir)) continue;
    await fs.mkdir(getSetsDir(dataDir), { recursive: true });
    await fs.rename(path.join(getTmpDir(dataDir), name), setDir);
    restored.push(name);
  }
  return restored;
};

// Only safe while holding the fetch lock: anything else in tmp is a leftover of a crashed run.
export const cleanTmpDir = async (dataDir: string): Promise<TmpCleanup> => {
  const tmpDir = getTmpDir(dataDir);
  await fs.mkdir(tmpDir, { recursive: true });
  const leftovers = (await fs.readdir(tmpDir)).filter(
    (name) => name !== LOCK_FILE_NAME,
  );
  const restored = await restoreOrphanedSets(dataDir, leftovers);
  const removed = leftovers.filter((name) => !restored.includes(name));
  await Promise.all(
    removed.map((name) =>
      fs.rm(path.join(tmpDir, name), { recursive: true, force: true }),
    ),
  );
  return { removed, restored };
};

export const createBuildDir = async (
  dataDir: string,
  date: string,
): Promise<string> => {
  const tmpDir = getTmpDir(dataDir);
  await fs.mkdir(tmpDir, { recursive: true });
  return fs.mkdtemp(path.join(tmpDir, `build-${date}-`));
};

// tmp and sets share DATA_DIR, so rename is atomic and a reader sees either no set or a full one.
export const publishSet = async (
  dataDir: string,
  date: string,
  buildDir: string,
): Promise<void> => {
  await fs.mkdir(getSetsDir(dataDir), { recursive: true });
  const setDir = getSetDir(dataDir, date);
  if (!(await pathExists(setDir))) {
    await fs.rename(buildDir, setDir);
    return;
  }
  // Directories can't be swapped in one step, so move the old set aside first and restore it on failure.
  const oldDir = path.join(
    getTmpDir(dataDir),
    `${OLD_SET_PREFIX}${date}-${randomUUID()}`,
  );
  await fs.rename(setDir, oldDir);
  try {
    await fs.rename(buildDir, setDir);
  } catch (err) {
    await fs.rename(oldDir, setDir);
    throw err;
  }
  await fs.rm(oldDir, { recursive: true, force: true });
};
