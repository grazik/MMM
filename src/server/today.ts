import { createLogger } from "@/log/logger";
import { isStale } from "@/scheduler/fetch-time";
import { listSetDates, readManifest } from "@/storage/sets";
import type { TodayItem, TodayResponse } from "@/types/api.types";
import type { Config } from "@/types/config.types";
import type { Manifest } from "@/types/manifest.types";
import { getMediaUrl } from "./media-path";

const log = createLogger("server");

// A broken newest manifest must not blank the page, so fall back to the next newest readable set.
export const findNewestManifest = async (
  dataDir: string,
): Promise<Manifest | null> => {
  const dates = await listSetDates(dataDir);
  for (const date of dates.toReversed()) {
    const result = await readManifest(dataDir, date);
    if (result.ok) return result.value;
    log.error("skipping unreadable set manifest", undefined, {
      date,
      reason: result.message,
    });
  }
  return null;
};

export const toTodayResponse = (
  manifest: Manifest | null,
  now: Date,
  config: Pick<Config, "fetchCron" | "timezone">,
): TodayResponse => {
  if (!manifest) return { date: null, stale: false, items: [] };
  return {
    date: manifest.date,
    stale: isStale(manifest.date, now, config),
    items: manifest.items.map(
      (item): TodayItem => ({
        id: item.id,
        title: item.title,
        kind: item.kind,
        mediaUrl: getMediaUrl(manifest.date, item.mediaFile),
        ...(item.posterFile && {
          posterUrl: getMediaUrl(manifest.date, item.posterFile),
        }),
        width: item.width,
        height: item.height,
        ...(item.hasAudio !== undefined && { hasAudio: item.hasAudio }),
      }),
    ),
  };
};
