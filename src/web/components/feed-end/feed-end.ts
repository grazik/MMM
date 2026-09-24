import { ICONS } from "@/web/constants/icons";
import { formatEndSubtitle, UI_STRINGS } from "@/web/constants/strings";
import { el } from "@/web/lib/dom";
import "./feed-end.css";

const scrollToTop = () => {
  const isReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  window.scrollTo({ top: 0, behavior: isReducedMotion ? "auto" : "smooth" });
};

export const createFeedEnd = (total: number) => {
  const footer = el("footer", "feed-end");
  const button = el("button", "feed-end__top");
  button.type = "button";
  button.setAttribute("aria-label", UI_STRINGS.backToTop);
  button.innerHTML = ICONS.arrowUp;
  button.addEventListener("click", scrollToTop);
  footer.append(
    el("h2", "feed-end__title", UI_STRINGS.endTitle),
    el("p", "feed-end__text", formatEndSubtitle(total)),
    button,
  );
  return footer;
};
