import type { ManifestItem } from "@/types/manifest.types";
import { FETCH_ERRORS } from "./constants/fetcher.constants";
import { chooseMedia, isSupportedPostType } from "./media";
import { decodeHtmlEntities } from "./title";
import type {
  DownloadMedia,
  FetchHotPage,
  NineGagPost,
  SelectionResult,
  SkipCounts,
  SkipReason,
} from "./types/fetcher.types";

export type SelectOptions = {
  fetchPage: FetchHotPage;
  download: DownloadMedia;
  excludedIds: ReadonlySet<string>;
  setSize: number;
  maxPages: number;
};

const createSkipCounts = (): SkipCounts => ({
  unsupportedType: 0,
  promoted: 0,
  inPreviousSet: 0,
  duplicate: 0,
  noMedia: 0,
  downloadFailed: 0,
});

const getPreDownloadSkipReason = (
  post: NineGagPost,
  excludedIds: ReadonlySet<string>,
): SkipReason | null => {
  if (!isSupportedPostType(post.type)) return "unsupportedType";
  if (post.promoted) return "promoted";
  if (excludedIds.has(post.id)) return "inPreviousSet";
  return null;
};

const buildItem = async (
  post: NineGagPost,
  download: DownloadMedia,
): Promise<ManifestItem | "noMedia" | "downloadFailed"> => {
  const media = chooseMedia(post);
  if (!media) return "noMedia";
  const mediaFile = await download({
    url: media.url,
    kind: media.kind,
    baseName: post.id,
  });
  if (!mediaFile.ok) return "downloadFailed";
  // The poster only smooths video loading, so a failed poster doesn't cost the post.
  const posterFile = media.posterUrl
    ? await download({
        url: media.posterUrl,
        kind: "image",
        baseName: `${post.id}-poster`,
      })
    : null;
  return {
    id: post.id,
    title: decodeHtmlEntities(post.title),
    kind: media.kind,
    mediaFile: mediaFile.value,
    ...(posterFile?.ok ? { posterFile: posterFile.value } : {}),
    width: media.width,
    height: media.height,
    ...(media.hasAudio === undefined ? {} : { hasAudio: media.hasAudio }),
    postUrl: post.url,
  };
};

export const selectPosts = async ({
  fetchPage,
  download,
  excludedIds,
  setSize,
  maxPages,
}: SelectOptions): Promise<SelectionResult> => {
  const items: ManifestItem[] = [];
  const skipped = createSkipCounts();
  const seenIds = new Set<string>();
  let olderThan: string | undefined;
  let pages = 0;

  while (items.length < setSize && pages < maxPages) {
    const page = await fetchPage(olderThan);
    pages += 1;
    if (!page.ok) return { ok: false, message: page.message, skipped, pages };
    const { posts, isEndOfList } = page.value;
    // 9gag silently ignores bad pagination and repeats a page, which would loop forever.
    if (!posts.some((post) => !seenIds.has(post.id))) break;

    for (const post of posts) {
      if (items.length >= setSize) break;
      if (seenIds.has(post.id)) {
        skipped.duplicate += 1;
        continue;
      }
      seenIds.add(post.id);
      const reason = getPreDownloadSkipReason(post, excludedIds);
      if (reason) {
        skipped[reason] += 1;
        continue;
      }
      const item = await buildItem(post, download);
      if (typeof item === "string") {
        skipped[item] += 1;
        continue;
      }
      items.push(item);
    }

    if (isEndOfList) break;
    olderThan = posts.at(-1)?.id;
  }

  if (items.length < setSize)
    return {
      ok: false,
      message: `${FETCH_ERRORS.notEnoughPosts} (${items.length}/${setSize} after ${pages} pages)`,
      skipped,
      pages,
    };
  return { ok: true, items, skipped, pages };
};
