import { constants } from "node:fs";
import fs from "node:fs/promises";
import type { Result } from "@/types/result.types";
import { getSetsDir, getTmpDir } from "./paths";

// A bind-mounted DATA_DIR that Docker created is owned by root, so fail at startup instead of at the first fetch.
export const checkDataDirWritable = async (
  dataDir: string,
): Promise<Result> => {
  const dirs = [dataDir, getSetsDir(dataDir), getTmpDir(dataDir)];
  try {
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
      await fs.access(dir, constants.W_OK);
    }
    return { ok: true };
  } catch (err) {
    const uid = process.getuid?.() ?? "unknown";
    return {
      ok: false,
      message: `DATA_DIR ${dataDir} is not writable by uid ${uid} (${String(err)}); on the host run: chown -R ${uid}:${uid} <mounted data dir>`,
    };
  }
};
