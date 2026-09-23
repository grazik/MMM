const ITEMS_AHEAD = 2;

export type Preloadable = {
  element: HTMLElement;
  preload: () => void;
};

// Once an item enters the viewport, the next ones start loading in full so
// scrolling to them does not wait on the network.
export const preloadAhead = (items: Preloadable[]) => {
  const indexOf = new Map(items.map((item, index) => [item.element, index]));
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const index = indexOf.get(entry.target as HTMLElement);
      if (index === undefined) continue;
      for (const next of items.slice(index + 1, index + 1 + ITEMS_AHEAD)) {
        next.preload();
      }
      observer.unobserve(entry.target);
    }
  });
  for (const item of items) observer.observe(item.element);
};
