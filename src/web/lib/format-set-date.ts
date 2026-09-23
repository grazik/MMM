const SET_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// The API date is a calendar date, not an instant: formatting it as UTC midnight
// in UTC keeps the viewer's timezone from shifting it to the previous day.
const FORMATTER = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export const formatSetDate = (isoDate: string): string | null => {
  const match = SET_DATE_PATTERN.exec(isoDate);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const parts = FORMATTER.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")}`;
};
