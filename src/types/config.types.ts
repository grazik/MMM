export type Config = {
  port: number;
  dataDir: string;
  timezone: string;
  fetchCron: string;
  retryIntervalMinutes: number;
  retentionDays: number;
  setSize: number;
  maxPages: number;
};
