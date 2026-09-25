import { Cron } from "croner";
import { runFetch } from "@/fetcher/run-fetch";
import { createLogger } from "@/log/logger";
import { listSetDates } from "@/storage/sets";
import type { Config } from "@/types/config.types";
import type { Result } from "@/types/result.types";
import { shouldCatchUp } from "./fetch-time";

type Trigger = "cron" | "startup" | "retry";

export type Scheduler = { stop: () => void };

const log = createLogger("scheduler");

const MS_PER_MINUTE = 60_000;

export const startScheduler = (config: Config): Scheduler => {
  let isRunning = false;
  let isStopped = false;
  // A cron tick during a run is queued, not dropped: the run in flight may be building the previous day's set.
  let isCronRunQueued = false;
  let retryTimer: NodeJS.Timeout | undefined;

  const clearRetry = () => {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  };

  const isCatchUpNeeded = async () =>
    shouldCatchUp(await listSetDates(config.dataDir), new Date(), config);

  const execute = async (trigger: Trigger): Promise<Result> => {
    const startedAtMs = Date.now();
    log.info("fetch attempt started", { trigger });
    try {
      const result = await runFetch(config);
      const durationMs = Date.now() - startedAtMs;
      if (result.ok)
        log.info("fetch attempt succeeded", { trigger, durationMs });
      else
        log.warn("fetch attempt failed", {
          trigger,
          durationMs,
          reason: result.message,
        });
      return result;
    } catch (err) {
      log.error("fetch attempt crashed", err, {
        trigger,
        durationMs: Date.now() - startedAtMs,
      });
      return { ok: false, message: String(err) };
    }
  };

  const scheduleRetry = () => {
    clearRetry();
    log.info("fetch retry scheduled", {
      inMinutes: config.retryIntervalMinutes,
    });
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void attempt("retry");
    }, config.retryIntervalMinutes * MS_PER_MINUTE);
  };

  const attempt = async (trigger: Trigger) => {
    if (isStopped) return;
    if (isRunning) {
      if (trigger === "cron") isCronRunQueued = true;
      log.info("fetch attempt skipped, another is in progress", { trigger });
      return;
    }
    isRunning = true;
    clearRetry();
    // Retries only make sense while today's set is missing past the fetch time; before it, the cron run takes over.
    const isNeeded = trigger !== "retry" || (await isCatchUpNeeded());
    if (!isNeeded) log.info("fetch retry no longer needed");
    const result = isNeeded ? await execute(trigger) : null;
    isRunning = false;
    if (isStopped) return;
    if (isCronRunQueued) {
      isCronRunQueued = false;
      void attempt("cron");
      return;
    }
    if (result && !result.ok) scheduleRetry();
  };

  const job = new Cron(
    config.fetchCron,
    { timezone: config.timezone, name: "daily-fetch" },
    () => {
      void attempt("cron");
    },
  );
  log.info("scheduler started", {
    cron: config.fetchCron,
    timezone: config.timezone,
    nextRunAt: job.nextRun()?.toISOString() ?? null,
  });

  void (async () => {
    if (await isCatchUpNeeded()) await attempt("startup");
  })();

  return {
    stop: () => {
      isStopped = true;
      job.stop();
      clearRetry();
      log.info("scheduler stopped");
    },
  };
};
