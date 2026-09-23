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

// Only safe while holding the fetch lock: anything else in tmp is a leftover of a crashed run.
export const cleanTmpDir = async (dataDir: string): Promise<string[]> => {
  const tmpDir = getTmpDir(dataDir);
  await fs.mkdir(tmpDir, { recursive: true });
  const leftovers = (await fs.readdir(tmpDir)).filter(
    (name) => name !== LOCK_FILE_NAME,
  );
  await Promise.all(
    leftovers.map((name) =>
      fs.rm(path.join(tmpDir, name), { recursive: true, force: true }),
    ),
  );
  return leftovers;
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
  const oldDir = path.join(getTmpDir(dataDir), `old-${date}-${randomUUID()}`);
  await fs.rename(setDir, oldDir);
  try {
    await fs.rename(buildDir, setDir);
  } catch (err) {
    await fs.rename(oldDir, setDir);
    throw err;
  }
  await fs.rm(oldDir, { recursive: true, force: true });
};
