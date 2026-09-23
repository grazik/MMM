import { fetchToday } from "@/web/api/fetch-today";
import { createAppHeader } from "@/web/components/app-header/app-header";
import { createEmptyState } from "@/web/components/empty-state/empty-state";
import { createFeed } from "@/web/components/feed/feed";
import { createFeedEnd } from "@/web/components/feed-end/feed-end";
import { createStaleNotice } from "@/web/components/stale-notice/stale-notice";
import { UI_STRINGS } from "@/web/constants/strings";
import "@/web/styles/fonts.css";
import "@/web/styles/tokens.css";
import "@/web/styles/base.css";

const render = async (root: HTMLElement) => {
  const result = await fetchToday();
  if (!result.ok) {
    console.error("[main] failed to load /api/today", result.message);
    root.replaceChildren(
      createAppHeader(null),
      createEmptyState(UI_STRINGS.loadFailed),
    );
    return;
  }

  const { date, stale, items } = result.value;
  const header = createAppHeader(date);
  if (items.length === 0) {
    root.replaceChildren(header, createEmptyState(UI_STRINGS.empty));
    return;
  }
  root.replaceChildren(
    header,
    ...(stale ? [createStaleNotice()] : []),
    createFeed(items),
    createFeedEnd(),
  );
};

const root = document.getElementById("app");
if (!root) throw new Error("#app root element missing");
void render(root);
