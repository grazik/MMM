import { Cron } from "croner";
import { getLocalDate } from "@/time/date";
import type { Config } from "@/types/config.types";

type FetchTimeConfig = Pick<Config, "fetchCron" | "timezone">;

// Starting this far before local midnight covers DST days, where wall-clock time since midnight is off by an hour.
const LOOKBACK_MARGIN_MS = 3 * 60 * 60 * 1_000;

const getLocalMsSinceMidnight = (now: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return (
    ((getPart("hour") * 60 + getPart("minute")) * 60 + getPart("second")) *
      1_000 +
    now.getMilliseconds()
  );
};

// The first cron run on the local date of `now`, or null when the cron does not fire that day.
export const getTodaysFetchTime = (
  now: Date,
  config: FetchTimeConfig,
): Date | null => {
  const today = getLocalDate(now, config.timezone);
  const cron = new Cron(config.fetchCron, {
    timezone: config.timezone,
    paused: true,
  });
  const lookbackStart = new Date(
    now.getTime() -
      getLocalMsSinceMidnight(now, config.timezone) -
      LOOKBACK_MARGIN_MS,
  );
  let run = cron.nextRun(lookbackStart);
  while (run && getLocalDate(run, config.timezone) < today)
    run = cron.nextRun(run);
  if (!run || getLocalDate(run, config.timezone) !== today) return null;
  return run;
};

export const isPastTodaysFetchTime = (now: Date, config: FetchTimeConfig) => {
  const fetchTime = getTodaysFetchTime(now, config);
  return fetchTime !== null && now.getTime() >= fetchTime.getTime();
};

export const isStale = (
  newestSetDate: string | null,
  now: Date,
  config: FetchTimeConfig,
) => {
  if (newestSetDate === null) return false;
  if (newestSetDate >= getLocalDate(now, config.timezone)) return false;
  return isPastTodaysFetchTime(now, config);
};

export const shouldCatchUp = (
  setDates: readonly string[],
  now: Date,
  config: FetchTimeConfig,
) => {
  if (setDates.includes(getLocalDate(now, config.timezone))) return false;
  return isPastTodaysFetchTime(now, config);
};
