const THRESHOLDS = Array.from({ length: 11 }, (_, i) => i / 10);
const MIN_VISIBLE_RATIO = 0.5;

// A video taller than twice the viewport can never be 50% visible, so it also
// counts as "in view" when it fills at least half of the viewport.
const visibleScore = (entry: IntersectionObserverEntry) => {
  const viewportHeight = entry.rootBounds?.height ?? window.innerHeight;
  const viewportShare =
    viewportHeight > 0 ? entry.intersectionRect.height / viewportHeight : 0;
  return Math.max(entry.intersectionRatio, viewportShare);
};

const play = (video: HTMLVideoElement) => {
  if (!video.paused) return;
  video.play().catch((err: unknown) => {
    console.error("[video-autoplay] play() rejected", err);
  });
};

export const createVideoAutoplay = () => {
  const scores = new Map<HTMLVideoElement, number>();

  const update = () => {
    let best: HTMLVideoElement | null = null;
    let bestScore = MIN_VISIBLE_RATIO;
    for (const [video, score] of scores) {
      if (score >= bestScore) {
        best = video;
        bestScore = score;
      }
    }
    for (const video of scores.keys()) {
      if (video === best) continue;
      if (!video.paused) video.pause();
    }
    if (best) play(best);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target instanceof HTMLVideoElement) {
          scores.set(entry.target, visibleScore(entry));
        }
      }
      update();
    },
    { threshold: THRESHOLDS },
  );

  return {
    observe: (video: HTMLVideoElement) => {
      scores.set(video, 0);
      observer.observe(video);
    },
  };
};
