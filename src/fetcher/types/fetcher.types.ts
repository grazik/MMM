import type { z } from "zod";
import type { MediaKind } from "@/types/api.types";
import type { ManifestItem } from "@/types/manifest.types";
import type { ValueResult } from "@/types/result.types";
import type { POST_SCHEMA } from "../nine-gag-schema";

export type NineGagPost = z.infer<typeof POST_SCHEMA>;

export type HotPage = {
  posts: NineGagPost[];
  isEndOfList: boolean;
};

export type FetchHotPage = (
  olderThan?: string,
) => Promise<ValueResult<HotPage>>;

export type MediaChoice = Pick<
  ManifestItem,
  "kind" | "width" | "height" | "hasAudio"
> & {
  url: string;
  posterUrl?: string;
};

export type DownloadRequest = {
  url: string;
  kind: MediaKind;
  baseName: string;
};

// Resolves to the stored file name, relative to the set directory.
export type DownloadMedia = (
  request: DownloadRequest,
) => Promise<ValueResult<string>>;

export type SkipReason =
  | "unsupportedType"
  | "promoted"
  | "inPreviousSet"
  | "duplicate"
  | "noMedia"
  | "downloadFailed";

export type SkipCounts = Record<SkipReason, number>;

export type SelectionResult =
  | { ok: true; items: ManifestItem[]; skipped: SkipCounts; pages: number }
  | { ok: false; message: string; skipped: SkipCounts; pages: number };
