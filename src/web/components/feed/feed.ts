import type { TodayItem } from "@/types/api.types";
import { createFeedItem } from "@/web/components/feed-item/feed-item";
import { el } from "@/web/lib/dom";
import { createVideoAutoplay } from "@/web/lib/video-autoplay";
import "./feed.css";

export const createFeed = (items: TodayItem[]) => {
  const list = el("ol", "feed");
  const autoplay = createVideoAutoplay();
  items.forEach((item, index) => {
    const listItem = el("li", "feed__entry");
    listItem.append(
      createFeedItem({
        item,
        position: index + 1,
        total: items.length,
        onVideo: autoplay.observe,
      }),
    );
    list.append(listItem);
  });
  return list;
};
