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
      // The container can't see how Docker maps its uid on the host, so name the common case and the exception.
      message: `DATA_DIR ${dataDir} is not writable by container uid ${uid} (${String(err)}); chown the mounted host directory to the host uid that maps to it (${uid} unless Docker runs rootless or with userns-remap)`,
    };
  }
};
