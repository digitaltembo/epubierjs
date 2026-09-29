/**
 * The reader's stylesheet, scoped under `.epubier`. The theme is a set of
 * CSS custom properties, which `styles` overrides (see THEME_VARIABLES) or
 * host CSS can set on the reader element.
 */
const css = `
.epubier {
  --ep-bg: #f4f1ea;
  --ep-page: #fff;
  --ep-ink: #24231f;
  --ep-muted: #686157;
  --ep-line: #d3cbbc;
  --ep-accent: #8a5a1c;
  --ep-font: system-ui, sans-serif;
  --ep-font-size: 15px;
  /* Keeps lines a comfortable length: roughly 470px of text per page in a
     two-page spread, even on wide screens */
  --ep-max-width: 66rem;

  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-columns: minmax(0, 1fr);
  height: 100%;
  min-height: 20rem;
  overflow: hidden;
  container-type: inline-size;
  background: var(--ep-bg);
  color: var(--ep-ink);
  font-family: var(--ep-font);
  font-size: var(--ep-font-size);
  line-height: normal;
  text-align: left;
}

.epubier,
.epubier *,
.epubier *::before,
.epubier *::after {
  box-sizing: border-box;
}

.epubier [hidden] {
  display: none !important;
}

.epubier button,
.epubier input {
  font: inherit;
  color: inherit;
}

/* ---------- Toolbar ---------- */

.epubier .ep-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--ep-line);
}

.epubier .ep-tool {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ep-ink);
  cursor: pointer;
}

.epubier .ep-tool:hover,
.epubier .ep-tool:focus-visible {
  background: rgb(0 0 0 / 0.07);
}

.epubier .ep-tool svg {
  display: block;
  width: 1.3rem;
  height: 1.3rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.epubier .ep-book-info {
  flex: 1;
  min-width: 0;
  text-align: center;
  line-height: 1.3;
}

.epubier .ep-book-title,
.epubier .ep-chapter {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.epubier .ep-book-title {
  font-weight: 600;
}

.epubier .ep-chapter {
  color: var(--ep-muted);
  font-size: 0.85em;
  font-style: italic;
}

/* ---------- Reader ---------- */

.epubier .ep-reader {
  display: flex;
  align-items: stretch;
  min-height: 0;
  padding: 0.75rem 0;
}

.epubier .ep-viewer {
  position: relative;
  flex: 1;
  min-width: 0;
  max-width: var(--ep-max-width);
  margin: 0 auto;
  background: var(--ep-page);
  border-radius: 4px;
  box-shadow: 0 1px 6px rgb(0 0 0 / 0.15);
  overflow: hidden;
}

/* Gutter between the pages of a two-page spread */
.epubier .ep-viewer.ep-spread::after {
  content: "";
  position: absolute;
  top: 4%;
  bottom: 4%;
  left: 50%;
  width: 1px;
  background: rgb(0 0 0 / 0.1);
  box-shadow: 0 0 12px rgb(0 0 0 / 0.25);
  pointer-events: none;
}

.epubier .ep-message {
  padding: 2rem;
  color: var(--ep-muted);
  text-align: center;
}

.epubier .ep-arrow {
  flex-shrink: 0;
  width: 3.5rem;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ep-line);
  font-size: 3.5rem;
  line-height: 1;
  cursor: pointer;
  user-select: none;
}

.epubier .ep-arrow:hover,
.epubier .ep-arrow:focus-visible {
  color: var(--ep-ink);
}

/* ---------- Footer ---------- */

.epubier .ep-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0 1rem 0.6rem;
}

.epubier .ep-progress {
  width: min(40rem, 100%);
  margin: 0;
  accent-color: var(--ep-accent);
}

.epubier .ep-status-line {
  display: flex;
  align-items: center;
  gap: 0.4em;
}

.epubier .ep-page-info {
  color: var(--ep-muted);
  font-size: 0.85em;
  text-align: center;
  min-height: 1.2em;
}

/* ---------- Loading ---------- */

.epubier .ep-spinner,
.epubier.ep-fullscreen.ep-counting-pages .ep-corner-info::before {
  display: inline-block;
  width: 0.9em;
  height: 0.9em;
  border: 2px solid var(--ep-line);
  border-top-color: var(--ep-accent);
  border-radius: 50%;
  animation: ep-spin 0.8s linear infinite;
}

@keyframes ep-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .epubier .ep-spinner,
  .epubier.ep-fullscreen.ep-counting-pages .ep-corner-info::before {
    animation-duration: 2.5s;
  }
}

/* Centered on the page until the book first renders */
.epubier .ep-loading {
  display: none;
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  width: 2.5rem;
  height: 2.5rem;
  margin: -1.25rem 0 0 -1.25rem;
  border-width: 3px;
}

.epubier.ep-loading-book .ep-loading {
  display: block;
}

/* Next to the page info while page numbers are being counted */
.epubier .ep-counting {
  display: none;
}

.epubier.ep-counting-pages .ep-counting {
  display: inline-block;
}

.epubier.ep-fullscreen.ep-counting-pages .ep-corner-info::before {
  content: "";
  vertical-align: -0.15em;
}

/* ---------- Side panels ---------- */

.epubier .ep-scrim {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgb(0 0 0 / 0.3);
}

.epubier .ep-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 11;
  width: min(24rem, 90%);
  display: flex;
  flex-direction: column;
  background: var(--ep-page);
  box-shadow: 0 0 24px rgb(0 0 0 / 0.25);
  visibility: hidden;
  transition:
    transform 0.2s ease-out,
    visibility 0.2s;
}

.epubier .ep-panel.ep-left {
  left: 0;
  transform: translateX(-100%);
}

.epubier .ep-panel.ep-right {
  right: 0;
  transform: translateX(100%);
}

.epubier .ep-panel.ep-open {
  visibility: visible;
  transform: none;
  /* Become visible (and focusable) immediately; hide only after sliding out */
  transition: transform 0.2s ease-out;
}

.epubier .ep-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  border-bottom: 1px solid var(--ep-line);
}

.epubier .ep-panel h2 {
  margin: 0;
  font-size: 1.05rem;
}

.epubier .ep-toc {
  overflow-y: auto;
  padding: 0.5rem 0;
}

.epubier .ep-toc ol {
  list-style: none;
  margin: 0;
  padding: 0;
}

.epubier .ep-toc ol ol {
  padding-left: 1rem;
}

.epubier .ep-toc a {
  display: block;
  padding: 0.4rem 1rem;
  color: var(--ep-ink);
  text-decoration: none;
  border-left: 3px solid transparent;
}

.epubier .ep-toc a:hover,
.epubier .ep-toc a:focus-visible {
  background: var(--ep-bg);
}

.epubier .ep-toc a.ep-active {
  border-left-color: var(--ep-accent);
  background: var(--ep-bg);
  font-weight: 600;
}

/* ---------- Bookmarks & highlights ---------- */

.epubier .ep-bookmark-button[aria-pressed="true"] {
  color: var(--ep-accent);
}

.epubier .ep-bookmark-button[aria-pressed="true"] svg {
  fill: currentColor;
}

.epubier .ep-tabs {
  display: flex;
  gap: 0.25rem;
}

.epubier .ep-tabs button {
  margin: 0;
  padding: 0.4rem 0.6rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--ep-muted);
  cursor: pointer;
}

.epubier .ep-tabs button[aria-selected="true"] {
  color: var(--ep-ink);
  font-weight: 600;
  border-bottom-color: var(--ep-accent);
}

.epubier .ep-note-list {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0;
  overflow-y: auto;
}

.epubier .ep-note-list li {
  display: flex;
  align-items: flex-start;
  border-left: 4px solid var(--ep-line);
  border-bottom: 1px solid var(--ep-bg);
}

.epubier .ep-note-list li.ep-empty {
  display: block;
  border: none;
  padding: 1rem;
  color: var(--ep-muted);
  font-size: 0.9em;
}

.epubier .ep-note-list a {
  flex: 1;
  min-width: 0;
  padding: 0.6rem 0.75rem;
  color: var(--ep-ink);
  text-decoration: none;
  font-size: 0.9em;
  line-height: 1.4;
}

.epubier .ep-note-list a:hover,
.epubier .ep-note-list a:focus-visible {
  background: var(--ep-bg);
}

.epubier .ep-where {
  display: block;
  color: var(--ep-muted);
  font-size: 0.75rem;
  font-style: italic;
}

.epubier .ep-note-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}

.epubier .ep-note-list .ep-tool {
  margin: 0.25rem;
  width: 2rem;
  height: 2rem;
  color: var(--ep-muted);
}

.epubier .ep-note-list .ep-tool svg {
  width: 1.05rem;
  height: 1.05rem;
}

.epubier .ep-selection-menu {
  position: absolute;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.5rem;
  background: var(--ep-page);
  border: 1px solid var(--ep-line);
  border-radius: 999px;
  box-shadow: 0 4px 14px rgb(0 0 0 / 0.2);
}

.epubier .ep-swatch {
  width: 1.75rem;
  height: 1.75rem;
  margin: 0;
  padding: 0;
  border: 2px solid rgb(0 0 0 / 0.15);
  border-radius: 50%;
  cursor: pointer;
}

.epubier .ep-swatch[aria-pressed="true"] {
  border-color: var(--ep-ink);
}

.epubier .ep-selection-menu .ep-tool {
  width: 2rem;
  height: 2rem;
}

/* ---------- Sharing ---------- */

.epubier .ep-toast {
  position: absolute;
  left: 50%;
  bottom: calc(5rem + env(safe-area-inset-bottom));
  z-index: 20;
  transform: translate(-50%, 1rem);
  padding: 0.55rem 1rem;
  border-radius: 999px;
  background: var(--ep-ink);
  color: var(--ep-page);
  font-size: 0.9em;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.epubier .ep-toast.ep-show {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* ---------- Search ---------- */

.epubier .ep-search-form {
  margin: 0;
  padding: 0.75rem 1rem 0;
}

.epubier .ep-search-input {
  width: 100%;
  margin: 0;
  padding: 0.6rem;
  border: 1px solid var(--ep-line);
  border-radius: 4px;
  background: var(--ep-page);
}

.epubier .ep-search-status {
  margin: 0.5rem 1rem;
  color: var(--ep-muted);
  font-size: 0.85em;
}

.epubier .ep-search-results {
  list-style: none;
  margin: 0;
  padding: 0 0 1rem;
  overflow-y: auto;
}

.epubier .ep-search-results a {
  display: block;
  padding: 0.6rem 1rem;
  color: var(--ep-ink);
  text-decoration: none;
  font-size: 0.9em;
  line-height: 1.4;
  border-top: 1px solid var(--ep-bg);
}

.epubier .ep-search-results a:hover,
.epubier .ep-search-results a.ep-active {
  background: var(--ep-bg);
}

.epubier .ep-search-results mark {
  background: #fde68a;
  color: inherit;
}

/* ---------- Fullscreen ---------- */

.epubier .ep-fullscreen-button .ep-exit,
.epubier.ep-fullscreen .ep-fullscreen-button .ep-enter {
  display: none;
}

.epubier.ep-fullscreen .ep-fullscreen-button .ep-exit {
  display: block;
}

.epubier .ep-corner-info {
  display: none;
}

/* Covers the whole window, whether or not the browser's own fullscreen
   mode is available (it isn't for web pages on iPhone) */
.epubier.ep-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  height: auto;
  background: var(--ep-page);
  /* Toolbars float over the page, so only the reader is in the flow */
  grid-template-rows: minmax(0, 1fr);
}

.epubier.ep-fullscreen .ep-toolbar,
.epubier.ep-fullscreen .ep-footer {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 5;
  background: var(--ep-bg);
  box-shadow: 0 0 12px rgb(0 0 0 / 0.2);
  transition: transform 0.2s ease-out;
}

.epubier.ep-fullscreen .ep-toolbar {
  top: 0;
  transform: translateY(-110%);
  padding-top: max(0.4rem, env(safe-area-inset-top));
  padding-left: max(0.5rem, env(safe-area-inset-left));
  padding-right: max(0.5rem, env(safe-area-inset-right));
}

.epubier.ep-fullscreen .ep-footer {
  bottom: 0;
  transform: translateY(110%);
  padding-top: 0.6rem;
  padding-bottom: max(0.6rem, env(safe-area-inset-bottom));
}

.epubier.ep-fullscreen.ep-show-controls .ep-toolbar,
.epubier.ep-fullscreen.ep-show-controls .ep-footer {
  transform: none;
}

.epubier.ep-fullscreen .ep-reader {
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
    calc(1.4rem + env(safe-area-inset-bottom)) env(safe-area-inset-left);
}

.epubier.ep-fullscreen .ep-arrow {
  display: none;
}

.epubier.ep-fullscreen .ep-viewer {
  border-radius: 0;
  box-shadow: none;
}

.epubier.ep-fullscreen .ep-corner-info {
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(0.25rem + env(safe-area-inset-bottom));
  text-align: center;
  color: var(--ep-muted);
  font-size: 0.75rem;
  pointer-events: none;
  transition: opacity 0.2s;
}

.epubier.ep-fullscreen.ep-show-controls .ep-corner-info {
  opacity: 0;
}

/* ---------- Narrow readers ---------- */

@container (max-width: 600px) {
  .epubier .ep-reader {
    padding: 0;
  }

  .epubier .ep-viewer {
    border-radius: 0;
    box-shadow: none;
  }

  .epubier .ep-arrow {
    width: 2rem;
    font-size: 2.5rem;
  }
}
`;

/** Friendly names for the theme's custom properties, for the `styles` option */
export const THEME_VARIABLES = {
  background: "--ep-bg",
  page: "--ep-page",
  text: "--ep-ink",
  muted: "--ep-muted",
  border: "--ep-line",
  accent: "--ep-accent",
  font: "--ep-font",
  fontSize: "--ep-font-size",
  maxPageWidth: "--ep-max-width",
};

const STYLE_ID = "epubier-styles";

/** Adds the stylesheet to the page once, before other styles so they can override it */
export function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.prepend(style);
}

/**
 * Applies `styles` overrides to one reader: theme names from
 * THEME_VARIABLES, or any `--custom-property`.
 */
export function applyStyleOverrides(root, styles = {}) {
  for (const [key, value] of Object.entries(styles)) {
    const property = key.startsWith("--") ? key : THEME_VARIABLES[key];
    if (!property) {
      console.warn(`epubier: unknown style "${key}"; expected one of ${Object.keys(THEME_VARIABLES).join(", ")} or a --custom-property`);
      continue;
    }
    root.style.setProperty(property, value);
  }
}
