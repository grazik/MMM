import fs from "node:fs/promises";
import { z } from "zod";
import { DATE_PATTERN } from "@/time/date";
import type { Manifest } from "@/types/manifest.types";
import type { ValueResult } from "@/types/result.types";
import { getManifestPath, getSetsDir } from "./paths";

const MANIFEST_SCHEMA = z.object({
  date: z.string().regex(DATE_PATTERN),
  fetchedAt: z.string(),
  items: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string(),
      kind: z.enum(["image", "video"]),
      mediaFile: z.string().min(1),
      posterFile: z.string().min(1).optional(),
      width: z.number().positive(),
      height: z.number().positive(),
      hasAudio: z.boolean().optional(),
      postUrl: z.string(),
    }),
  ),
}) satisfies z.ZodType<Manifest>;

// Set directories only appear through an atomic rename, so every dated directory is a complete set.
export const listSetDates = async (dataDir: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(getSetsDir(dataDir), {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isDirectory() && DATE_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
};

export const readManifest = async (
  dataDir: string,
  date: string,
): Promise<ValueResult<Manifest>> => {
  try {
    const raw: unknown = JSON.parse(
      await fs.readFile(getManifestPath(dataDir, date), "utf8"),
    );
    const parsed = MANIFEST_SCHEMA.safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        message: `Invalid manifest for ${date}: ${z.prettifyError(parsed.error)}`,
      };
    return { ok: true, value: parsed.data };
  } catch (err) {
    return {
      ok: false,
      message: `Cannot read manifest for ${date}: ${String(err)}`,
    };
  }
};
