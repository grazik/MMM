export const UI_STRINGS = {
  appName: "Memy Małej Moni",
  staleNotice:
    "Today's memes aren't ready yet, so here's yesterday's set. Retrying in the background.",
  empty: "No memes yet. The first set is on its way.",
  loadFailed: "Couldn't load the memes. Try again in a moment.",
  endTitle: "Come back tomorrow",
  backToTop: "Back to top",
  mute: "Mute",
  unmute: "Unmute",
} as const;

export const formatCounter = (position: number, total: number) =>
  `${position} / ${total}`;

export const formatEndSubtitle = (total: number) =>
  `That was all ${total} for today.`;
