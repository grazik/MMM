import type { TodayItem } from "@/shared/types/api.types";
import { createFeedItem } from "@/web/components/feed-item/feed-item";
import { el } from "@/web/lib/dom";
import { preloadAhead } from "@/web/lib/preload-ahead";
import { createVideoAutoplay } from "@/web/lib/video-autoplay";
import "./feed.css";

export const createFeed = (items: TodayItem[]) => {
  const list = el("ol", "feed");
  const autoplay = createVideoAutoplay();
  const entries = items.map((item, index) => {
    const entry = createFeedItem({
      item,
      position: index + 1,
      total: items.length,
      onVideo: autoplay.observe,
    });
    const listItem = el("li", "feed__entry");
    listItem.append(entry.element);
    list.append(listItem);
    return { element: listItem, preload: entry.preload };
  });
  preloadAhead(entries);
  return list;
};
