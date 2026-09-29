/** Inline SVG icons, drawn with `stroke: currentColor` by the stylesheet */
const svg = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

export const icons = {
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6" />'),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />'),
  bookmark: svg('<path d="M6 3h12v18l-6-4.5L6 21z" />'),
  fullscreenEnter: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />'),
  fullscreenExit: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />'),
  share: svg('<path d="M14 4l6 6-6 6" /><path d="M20 10h-7a9 9 0 0 0-9 9v1" />'),
  search: svg('<circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />'),
  close: svg('<path d="M6 6l12 12M18 6L6 18" />'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />'),
};
