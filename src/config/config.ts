import { z } from "zod";
import type { Config } from "@/types/config.types";

export const CONFIG_SCHEMA = z.object({
  port: z.coerce.number().int().positive().default(3_000),
  dataDir: z.string().min(1).default("/data"),
  timezone: z.string().min(1).default("Europe/Warsaw"),
  fetchCron: z.string().min(1).default("0 6 * * *"),
  retryIntervalMinutes: z.coerce.number().positive().default(15),
  retentionDays: z.coerce.number().int().positive().default(3),
  setSize: z.coerce.number().int().positive().default(10),
  maxPages: z.coerce.number().int().positive().default(5),
});

// Invalid configuration is a deploy bug, so fail fast instead of returning a Result.
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const parsed = CONFIG_SCHEMA.safeParse({
    port: env.PORT,
    dataDir: env.DATA_DIR,
    timezone: env.TIMEZONE,
    fetchCron: env.FETCH_CRON,
    retryIntervalMinutes: env.RETRY_INTERVAL_MINUTES,
    retentionDays: env.RETENTION_DAYS,
    setSize: env.SET_SIZE,
    maxPages: env.MAX_PAGES,
  });
  if (!parsed.success)
    throw new Error(`Invalid configuration: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
};
