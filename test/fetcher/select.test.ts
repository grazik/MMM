import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chooseMedia } from "@/fetcher/media";
import { parseHotPage } from "@/fetcher/nine-gag-client";
import { selectPosts } from "@/fetcher/select";
import type {
  DownloadMedia,
  FetchHotPage,
  HotPage,
  NineGagPost,
} from "@/fetcher/types/fetcher.types";

const loadFixturePages = (): HotPage[] => {
  const raw: unknown = JSON.parse(
    readFileSync(
      new URL("../fixtures/sample-hot.json", import.meta.url),
      "utf8",
    ),
  );
  if (!Array.isArray(raw)) throw new Error("fixture must be an array");
  return raw.map((response: unknown) => {
    const page = parseHotPage(response);
    if (!page.ok) throw new Error(page.message);
    return page.value;
  });
};

const FIXTURE_PAGES = loadFixturePages();
const FIXTURE_IDS = FIXTURE_PAGES.flatMap((page) =>
  page.posts.map((post) => post.id),
);

// Serves pages the way the API paginates: page N+1 is `olderThan` the last id of page N.
const createPageFetcher = (pages: HotPage[]) => {
  const requests: (string | undefined)[] = [];
  const fetchPage: FetchHotPage = async (olderThan) => {
    requests.push(olderThan);
    if (olderThan === undefined)
      return { ok: true, value: pages[0] ?? { posts: [], isEndOfList: true } };
    const index = pages.findIndex(
      (page) => page.posts.at(-1)?.id === olderThan,
    );
    const next = pages[index + 1];
    if (index === -1 || !next)
      return { ok: true, value: { posts: [], isEndOfList: true } };
    return { ok: true, value: next };
  };
  return { fetchPage, requests };
};

const createDownload = (failingUrls: ReadonlySet<string> = new Set()) => {
  const requests: Parameters<DownloadMedia>[0][] = [];
  const download: DownloadMedia = async (request) => {
    requests.push(request);
    if (failingUrls.has(request.url)) return { ok: false, message: "boom" };
    return {
      ok: true,
      value: `${request.baseName}.${request.kind === "video" ? "mp4" : "jpg"}`,
    };
  };
  return { download, requests };
};

const getFixturePost = (id: string): NineGagPost => {
  const post = FIXTURE_PAGES.flatMap((page) => page.posts).find(
    (p) => p.id === id,
  );
  if (!post) throw new Error(`no fixture post ${id}`);
  return post;
};

const PHOTO_POST = getFixturePost("a87rD2O");
const ANIMATED_POST = getFixturePost("aoyB4Y0");

const syntheticPost = (overrides: Partial<NineGagPost>): NineGagPost => ({
  ...PHOTO_POST,
  ...overrides,
});

const select = (options: {
  pages?: HotPage[];
  excludedIds?: string[];
  failingUrls?: string[];
  setSize?: number;
  maxPages?: number;
}) => {
  const pages = createPageFetcher(options.pages ?? FIXTURE_PAGES);
  const downloads = createDownload(new Set(options.failingUrls));
  const resultPromise = selectPosts({
    fetchPage: pages.fetchPage,
    download: downloads.download,
    excludedIds: new Set(options.excludedIds),
    setSize: options.setSize ?? 10,
    maxPages: options.maxPages ?? 5,
  });
  return { resultPromise, pages, downloads };
};

describe("selectPosts", () => {
  it("picks the first N posts in feed order when all are eligible", async () => {
    const { resultPromise, pages } = select({});
    const result = await resultPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((item) => item.id)).toEqual(
      FIXTURE_IDS.slice(0, 10),
    );
    expect(pages.requests).toEqual([undefined]);
    expect(Object.values(result.skipped).every((count) => count === 0)).toBe(
      true,
    );
  });

  it("builds manifest items with decoded titles and post urls", async () => {
    const page: HotPage = {
      posts: [
        syntheticPost({
          id: "t1",
          title:
            "Tom &amp; Jerry&#39;s &quot;caf&eacute;&quot; &#x27;ok&#x27; &lt;3 &amp;lt;",
        }),
      ],
      isEndOfList: true,
    };
    const result = await select({ pages: [page], setSize: 1 }).resultPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items[0]).toEqual({
      id: "t1",
      title: "Tom & Jerry's \"café\" 'ok' <3 &lt;",
      kind: "image",
      mediaFile: "t1.jpg",
      width: 700,
      height: 429,
      postUrl: PHOTO_POST.url,
    });
  });

  it("skips unsupported types and promoted posts", async () => {
    const page: HotPage = {
      posts: [
        syntheticPost({ id: "article", type: "Article" }),
        syntheticPost({ id: "embed", type: "EmbedVideo" }),
        syntheticPost({ id: "ad", promoted: 1 }),
        syntheticPost({
          id: "video",
          type: "Video",
          images: ANIMATED_POST.images,
        }),
        syntheticPost({ id: "photo" }),
      ],
      isEndOfList: true,
    };
    const result = await select({ pages: [page], setSize: 2 }).resultPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((item) => item.id)).toEqual(["video", "photo"]);
    expect(result.skipped.unsupportedType).toBe(2);
    expect(result.skipped.promoted).toBe(1);
  });

  it("skips posts whose id is not safe as a file name", async () => {
    const page: HotPage = {
      posts: [
        syntheticPost({ id: "../../escape" }),
        syntheticPost({ id: "a/b" }),
        syntheticPost({ id: "ok_id-1" }),
      ],
      isEndOfList: true,
    };
    const { resultPromise, downloads } = select({ pages: [page], setSize: 1 });
    const result = await resultPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((item) => item.id)).toEqual(["ok_id-1"]);
    expect(result.skipped.unsafeId).toBe(2);
    expect(downloads.requests.map((request) => request.baseName)).toEqual([
      "ok_id-1",
    ]);
  });

  it("skips posts from the previous set and fetches the next page", async () => {
    const excludedIds = FIXTURE_IDS.slice(0, 3);
    const { resultPromise, pages } = select({ excludedIds });
    const result = await resultPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((item) => item.id)).toEqual(
      FIXTURE_IDS.slice(3, 13),
    );
    expect(result.skipped.inPreviousSet).toBe(3);
    expect(pages.requests).toEqual([undefined, FIXTURE_IDS[9]]);
  });

  it("does not check duplicates when there is no previous set", async () => {
    const result = await select({ excludedIds: [] }).resultPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped.inPreviousSet).toBe(0);
  });

  it("skips posts whose media download fails but keeps posts whose poster fails", async () => {
    const failingMedia =
      getFixturePost(FIXTURE_IDS[0] ?? "").images.image460sv?.url ?? "";
    const failingPoster =
      getFixturePost(FIXTURE_IDS[1] ?? "").images.image460?.url ?? "";
    const result = await select({ failingUrls: [failingMedia, failingPoster] })
      .resultPromise;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.map((item) => item.id)).toEqual(
      FIXTURE_IDS.slice(1, 11),
    );
    expect(result.skipped.downloadFailed).toBe(1);
    expect(result.items[0]?.posterFile).toBeUndefined();
    expect(result.items[0]?.mediaFile).toBe(`${FIXTURE_IDS[1]}.mp4`);
  });

  it("fails when fewer than N eligible posts exist within the page cap", async () => {
    const { resultPromise, pages } = select({
      excludedIds: FIXTURE_IDS.slice(0, 15),
      maxPages: 2,
    });
    const result = await resultPromise;
    expect(result.ok).toBe(false);
    expect(result.skipped.inPreviousSet).toBe(15);
    expect(result.pages).toBe(2);
    expect(pages.requests).toHaveLength(2);
  });

  it("fails when the feed ends before N eligible posts", async () => {
    const result = await select({ setSize: 31 }).resultPromise;
    expect(result.ok).toBe(false);
  });

  it("stops instead of looping when a page repeats already seen posts", async () => {
    const firstPage = FIXTURE_PAGES[0];
    if (!firstPage) throw new Error("fixture has no pages");
    const fetchPage: FetchHotPage = async () => ({
      ok: true,
      value: firstPage,
    });
    const result = await selectPosts({
      fetchPage,
      download: createDownload().download,
      excludedIds: new Set(),
      setSize: 15,
      maxPages: 5,
    });
    expect(result.ok).toBe(false);
    expect(result.pages).toBe(2);
  });

  it("propagates a page fetch failure", async () => {
    const fetchPage: FetchHotPage = async () => ({
      ok: false,
      message: "HTTP 401",
    });
    const result = await selectPosts({
      fetchPage,
      download: createDownload().download,
      excludedIds: new Set(),
      setSize: 10,
      maxPages: 5,
    });
    expect(result).toMatchObject({ ok: false, message: "HTTP 401" });
  });
});

describe("chooseMedia", () => {
  const video = ANIMATED_POST.images.image460sv;

  it("uses the MP4 variant, its size, audio flag and the image460 poster for animated posts", () => {
    expect(chooseMedia(ANIMATED_POST)).toEqual({
      kind: "video",
      url: video?.url,
      width: video?.width,
      height: video?.height,
      hasAudio: true,
      posterUrl: ANIMATED_POST.images.image460?.url,
    });
  });

  it("falls back to WebM only when there is no MP4", () => {
    const post = syntheticPost({
      type: "Video",
      images: {
        ...ANIMATED_POST.images,
        image460sv: {
          width: 460,
          height: 356,
          vp9Url: "https://x/v.webm",
          vp8Url: "https://x/v8.webm",
        },
      },
    });
    expect(chooseMedia(post)).toMatchObject({
      kind: "video",
      url: "https://x/v.webm",
    });
  });

  it("shows an animated post without a video variant as an image", () => {
    const { image460sv: _, ...images } = ANIMATED_POST.images;
    expect(
      chooseMedia(syntheticPost({ type: "Animated", images })),
    ).toMatchObject({
      kind: "image",
      url: ANIMATED_POST.images.image700?.url,
    });
  });

  it("uses image700 for photos and falls back to image460", () => {
    expect(chooseMedia(PHOTO_POST)).toEqual({
      kind: "image",
      url: PHOTO_POST.images.image700?.url,
      width: 700,
      height: 429,
    });
    const { image700: _, ...images } = PHOTO_POST.images;
    expect(chooseMedia(syntheticPost({ images }))).toMatchObject({
      url: PHOTO_POST.images.image460?.url,
      width: 460,
    });
  });

  it("returns null for a video without any video variant", () => {
    const { image460sv: _, ...images } = ANIMATED_POST.images;
    expect(chooseMedia(syntheticPost({ type: "Video", images }))).toBeNull();
  });
});
