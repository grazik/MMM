import type { TodayItem } from "@/types/api.types";
import { createFeedVideo } from "@/web/components/feed-video/feed-video";
import { formatCounter } from "@/web/constants/strings";
import { el } from "@/web/lib/dom";
import "./feed-item.css";

type FeedItemOptions = {
  item: TodayItem;
  position: number;
  total: number;
  onVideo: (video: HTMLVideoElement) => void;
};

const createImage = (item: TodayItem, isFirst: boolean) => {
  const img = el("img", "feed-item__image");
  img.alt = item.title;
  img.width = item.width;
  img.height = item.height;
  img.decoding = "async";
  img.loading = isFirst ? "eager" : "lazy";
  if (isFirst) img.fetchPriority = "high";
  img.src = item.mediaUrl;
  return img;
};

const createMedia = (options: FeedItemOptions) => {
  const { item, position, onVideo } = options;
  switch (item.kind) {
    case "image":
      return createImage(item, position === 1);
    case "video": {
      const { element, video } = createFeedVideo(item);
      onVideo(video);
      return element;
    }
    default:
      return item.kind satisfies never;
  }
};

export const createFeedItem = (options: FeedItemOptions) => {
  const { item, position, total } = options;
  const article = el("article", "feed-item");
  const header = el("div", "feed-item__header");
  header.append(
    el("span", "feed-item__counter", formatCounter(position, total)),
    el("h2", "feed-item__title", item.title),
  );

  const frame = el("div", "feed-item__media");
  if (item.width > 0 && item.height > 0) {
    article.style.setProperty(
      "--feed-item-aspect",
      `${item.width} / ${item.height}`,
    );
  }
  frame.append(createMedia(options));

  article.append(header, frame);
  return article;
};
