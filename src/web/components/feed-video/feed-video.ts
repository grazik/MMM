import type { TodayItem } from "@/shared/types/api.types";
import { ICONS } from "@/web/constants/icons";
import { UI_STRINGS } from "@/web/constants/strings";
import { el } from "@/web/lib/dom";
import "./feed-video.css";

type FeedVideoItem = Pick<
  TodayItem,
  "mediaUrl" | "posterUrl" | "width" | "height" | "hasAudio"
>;

const createMuteToggle = (video: HTMLVideoElement) => {
  const button = el("button", "feed-video__mute");
  button.type = "button";
  const render = () => {
    button.setAttribute(
      "aria-label",
      video.muted ? UI_STRINGS.unmute : UI_STRINGS.mute,
    );
    button.innerHTML = video.muted ? ICONS.speakerMuted : ICONS.speakerOn;
  };
  button.addEventListener("click", () => {
    video.muted = !video.muted;
    render();
  });
  render();
  return button;
};

export const createFeedVideo = (item: FeedVideoItem) => {
  const wrapper = el("div", "feed-video");
  const video = el("video", "feed-video__media");
  // iOS only allows inline autoplay for videos muted via the attribute itself.
  video.setAttribute("muted", "");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.width = item.width;
  video.height = item.height;
  if (item.posterUrl) video.poster = item.posterUrl;
  video.src = item.mediaUrl;
  wrapper.append(video);

  // hasAudio undefined means 9gag gave no audio info, so the toggle is shown.
  if (item.hasAudio !== false) wrapper.append(createMuteToggle(video));

  return {
    element: wrapper,
    video,
    preload: () => {
      video.preload = "auto";
    },
  };
};
