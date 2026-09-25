// Static, trusted markup only: these strings are assigned via innerHTML.
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const SPEAKER = '<path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/>';

export const ICONS = {
  speakerMuted: svg(`${SPEAKER}<path d="m22 9-6 6M16 9l6 6"/>`),
  speakerOn: svg(
    `${SPEAKER}<path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>`,
  ),
  refresh: svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>'),
  arrowUp: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
} as const;
