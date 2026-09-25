import fs from "node:fs/promises";
import path from "node:path";
import { createLogger } from "@/log/logger";
import { MANIFEST_FILE_NAME } from "@/storage/paths";
import { listSetDates, readManifest } from "@/storage/sets";
import { getLocalDate } from "@/time/date";
import type { Config } from "@/types/config.types";
import type { Manifest } from "@/types/manifest.types";
import type { Result } from "@/types/result.types";
import { FETCH_ERRORS } from "./constants/fetcher.constants";
import { createDownloader } from "./download";
import { acquireLock } from "./lock";
import { createHotPageFetcher, getGuestToken } from "./nine-gag-client";
import { cleanTmpDir, createBuildDir, publishSet } from "./publish";
import { applyRetention } from "./retention";
import { selectPosts } from "./select";
import type { DownloadMedia } from "./types/fetcher.types";

const log = createLogger("fetcher");

const loadPreviousIds = async (
  dataDir: string,
  targetDate: string,
): Promise<Set<string>> => {
  const previousDate = (await listSetDates(dataDir))
    .filter((date) => date < targetDate)
    .at(-1);
  if (!previousDate) return new Set();
  const manifest = await readManifest(dataDir, previousDate);
  if (!manifest.ok) {
    // Sets only appear via atomic rename, so this is corruption; failing every day over it would be worse.
    log.warn("previous set unreadable, skipping duplicate check", {
      previousDate,
      reason: manifest.message,
    });
    return new Set();
  }
  return new Set(manifest.value.items.map((item) => item.id));
};

const buildAndPublish = async (
  config: Config,
  date: string,
  now: Date,
): Promise<Result> => {
  const { removed, restored } = await cleanTmpDir(config.dataDir);
  if (restored.length > 0)
    log.warn("restored sets orphaned by an interrupted publish", { restored });
  if (removed.length > 0)
    log.warn("removed stale tmp leftovers", { leftovers: removed });

  const excludedIds = await loadPreviousIds(config.dataDir, date);
  const token = await getGuestToken();
  if (!token.ok) return token;

  const buildDir = await createBuildDir(config.dataDir, date);
  try {
    const downloadToBuildDir = createDownloader(buildDir);
    const download: DownloadMedia = async (request) => {
      const result = await downloadToBuildDir(request);
      if (!result.ok)
        log.warn("media download failed", {
          baseName: request.baseName,
          reason: result.message,
        });
      return result;
    };
    const selection = await selectPosts({
      fetchPage: createHotPageFetcher(token.value),
      download,
      excludedIds,
      setSize: config.setSize,
      maxPages: config.maxPages,
    });
    log.info("selection finished", {
      date,
      isOk: selection.ok,
      pages: selection.pages,
      skipped: selection.skipped,
    });
    if (!selection.ok) return { ok: false, message: selection.message };

    const manifest: Manifest = {
      date,
      fetchedAt: now.toISOString(),
      items: selection.items,
    };
    // Written last so a manifest only ever exists next to complete media.
    await fs.writeFile(
      path.join(buildDir, MANIFEST_FILE_NAME),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await publishSet(config.dataDir, date, buildDir);
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true });
  }

  // The set is already published; a cleanup failure must not turn it into a failed run and trigger retries.
  try {
    const deleted = await applyRetention(
      config.dataDir,
      date,
      config.retentionDays,
    );
    if (deleted.length > 0) log.info("retention removed old sets", { deleted });
  } catch (err) {
    log.error("retention failed", err, { date });
  }
  return { ok: true };
};

export const runFetch = async (
  config: Config,
  now: Date = new Date(),
): Promise<Result> => {
  const startedAtMs = Date.now();
  const date = getLocalDate(now, config.timezone);
  log.info("fetch started", { date });
  const finish = (result: Result): Result => {
    const durationMs = Date.now() - startedAtMs;
    if (result.ok) log.info("fetch succeeded", { date, durationMs });
    else log.warn("fetch failed", { date, durationMs, reason: result.message });
    return result;
  };

  try {
    const release = await acquireLock(config.dataDir);
    if (!release) return finish({ ok: false, message: FETCH_ERRORS.lockHeld });
    try {
      return finish(await buildAndPublish(config, date, now));
    } finally {
      await release();
    }
  } catch (err) {
    // Filesystem errors (disk full, permissions) must not kill the scheduler; the retry loop handles them.
    log.error("fetch crashed", err, { date });
    return finish({
      ok: false,
      message: `${FETCH_ERRORS.unexpected}: ${String(err)}`,
    });
  }
};
