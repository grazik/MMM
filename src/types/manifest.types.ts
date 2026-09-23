import type { TodayItem } from "@/shared/types/api.types";

export type ManifestItem = Pick<
  TodayItem,
  "id" | "title" | "kind" | "width" | "height" | "hasAudio"
> & {
  mediaFile: string;
  posterFile?: string;
  postUrl: string;
};

export type Manifest = {
  date: string;
  fetchedAt: string;
  items: ManifestItem[];
};
