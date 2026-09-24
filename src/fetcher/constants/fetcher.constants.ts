export const API_TIMEOUT_MS = 15_000;
export const MEDIA_TIMEOUT_MS = 60_000;

// The holder refreshes the lock at half this interval, so only a crashed or frozen run misses it.
export const LOCK_STALE_AFTER_MS = 30_000;

export const LOCK_FILE_NAME = "fetch.lock";

export const FETCH_ERRORS = {
  lockHeld: "Another fetch is already running",
  notEnoughPosts: "Not enough eligible posts in Hot",
  guestToken: "Cannot get a 9gag guest token",
  hotPage: "Cannot fetch a 9gag Hot page",
  invalidResponse: "Unexpected 9gag API response",
  unexpected: "Fetch failed unexpectedly",
} as const;
