// en-CA formats as YYYY-MM-DD, which is also the set directory name.
export const getLocalDate = (now: Date, timezone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
