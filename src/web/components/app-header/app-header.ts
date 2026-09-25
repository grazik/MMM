import { UI_STRINGS } from "@/web/constants/strings";
import { el } from "@/web/lib/dom";
import { formatSetDate } from "@/web/lib/format-set-date";
import "./app-header.css";

export const createAppHeader = (date: string | null) => {
  const header = el("header", "app-header");
  header.append(el("h1", "app-header__title", UI_STRINGS.appName));
  const formatted = date ? formatSetDate(date) : null;
  if (formatted) {
    const time = el("time", "app-header__date", formatted);
    time.dateTime = date ?? "";
    header.append(time);
  }
  return header;
};
