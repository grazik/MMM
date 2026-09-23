import type { MediaChoice, NineGagPost } from "./types/fetcher.types";

export const SUPPORTED_POST_TYPES = ["Photo", "Animated", "Video"] as const;

type SupportedPostType = (typeof SUPPORTED_POST_TYPES)[number];

export const isSupportedPostType = (type: string): type is SupportedPostType =>
  SUPPORTED_POST_TYPES.some((supported) => supported === type);

const chooseImage = (post: NineGagPost): MediaChoice | null => {
  const variant = post.images.image700 ?? post.images.image460;
  if (!variant) return null;
  return {
    kind: "image",
    url: variant.url,
    width: variant.width,
    height: variant.height,
  };
};

// MP4 (H.264) first because it is the only format iOS Safari plays everywhere.
const chooseVideo = (post: NineGagPost): MediaChoice | null => {
  const variant = post.images.image460sv;
  if (!variant) return null;
  const url = variant.url ?? variant.vp9Url ?? variant.vp8Url;
  if (!url) return null;
  const posterUrl = post.images.image460?.url;
  return {
    kind: "video",
    url,
    width: variant.width,
    height: variant.height,
    ...(variant.hasAudio === undefined
      ? {}
      : { hasAudio: Boolean(variant.hasAudio) }),
    ...(posterUrl ? { posterUrl } : {}),
  };
};

export const chooseMedia = (post: NineGagPost): MediaChoice | null => {
  const postType = post.type;
  if (!isSupportedPostType(postType)) return null;
  switch (postType) {
    case "Photo":
      return chooseImage(post);
    case "Animated":
      return chooseVideo(post) ?? chooseImage(post);
    case "Video":
      return chooseVideo(post);
    default: {
      postType satisfies never;
      return null;
    }
  }
};
