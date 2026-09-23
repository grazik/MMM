import fs from "node:fs/promises";
import { getSetDir } from "@/storage/paths";
import { listSetDates } from "@/storage/sets";

const DAY_MS = 24 * 60 * 60 * 1_000;

// Dates are calendar days, so UTC arithmetic on midnight avoids DST shifts.
const subtractDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS)
    .toISOString()
    .slice(0, 10);

// Pure so the rule is testable: keep dates newer than target − retentionDays, and always the newest (served) one.
export const getExpiredDates = (
  dates: readonly string[],
  targetDate: string,
  retentionDays: number,
): string[] => {
  const cutoff = subtractDays(targetDate, retentionDays);
  const newest = [...dates].sort().at(-1);
  return dates.filter((date) => date <= cutoff && date !== newest);
};

export const applyRetention = async (
  dataDir: string,
  targetDate: string,
  retentionDays: number,
): Promise<string[]> => {
  const expired = getExpiredDates(
    await listSetDates(dataDir),
    targetDate,
    retentionDays,
  );
  for (const date of expired)
    await fs.rm(getSetDir(dataDir, date), { recursive: true, force: true });
  return expired;
};
