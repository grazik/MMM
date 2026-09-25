export type MediaKind = "image" | "video";

export type TodayItem = {
  id: string;
  title: string;
  kind: MediaKind;
  mediaUrl: string;
  posterUrl?: string;
  width: number;
  height: number;
  hasAudio?: boolean;
};

export type TodayResponse = {
  date: string | null;
  stale: boolean;
  items: TodayItem[];
};
