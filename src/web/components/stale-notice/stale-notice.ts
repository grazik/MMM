import { ICONS } from "@/web/constants/icons";
import { UI_STRINGS } from "@/web/constants/strings";
import { el } from "@/web/lib/dom";
import "./stale-notice.css";

export const createStaleNotice = () => {
  const notice = el("p", "stale-notice");
  notice.setAttribute("role", "status");
  const icon = el("span", "stale-notice__icon");
  icon.innerHTML = ICONS.refresh;
  notice.append(icon, el("span", "stale-notice__text", UI_STRINGS.staleNotice));
  return notice;
};
