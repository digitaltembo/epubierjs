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
  /* The insets keep the toolbar's ends clear of what's over them, e.g. a window's buttons */
  padding: 0.4rem calc(0.5rem + var(--ep-toolbar-inset-right, 0px)) 0.4rem calc(0.5rem + var(--ep-toolbar-inset-left, 0px));
  border-bottom: 1px solid var(--ep-line);
}

/* The title bar of a window without one (Electron's frameless windows, a
   web app's window controls overlay): dragging it moves the window */
.epubier.ep-title-bar .ep-toolbar {
  -webkit-app-region: drag;
  app-region: drag;
}

/* What can be clicked there, and what can be over it */
.epubier.ep-title-bar .ep-toolbar button,
.epubier.ep-title-bar .ep-panel,
.epubier.ep-title-bar .ep-scrim,
.epubier.ep-title-bar .ep-selection-menu {
  -webkit-app-region: no-drag;
  app-region: no-drag;
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
  background: color-mix(in srgb, var(--ep-ink) 8%, transparent);
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
  background: color-mix(in srgb, var(--ep-ink) 10%, transparent);
  box-shadow: 0 0 12px rgb(0 0 0 / 0.25);
  pointer-events: none;
}

/* Reflowing text as a scroll is one column, kept to a comfortable line length */
.epubier.ep-scrolled.ep-reflowable .ep-viewer {
  max-width: min(var(--ep-max-width), 44rem);
}

/* A page of reflowing text on its own is as wide as one of a two-page
   spread (440px of text and 44px margins, pageGap in formats/epub/session.js),
   until there's room for the spread. That's when the page can be 900px wide
   (MIN_SPREAD_WIDTH): 1012px with the arrows either side, 900px when
   immersive, without them. The reader's width decides, not the page's, or
   the capped page could never get wide enough. */
@container (max-width: 1011.98px) {
  .epubier.ep-reflowable:not(.ep-scrolled):not(.ep-immersive) .ep-viewer {
    max-width: 33rem;
  }
}

@container (max-width: 899.98px) {
  .epubier.ep-reflowable.ep-immersive:not(.ep-scrolled) .ep-viewer {
    max-width: 33rem;
  }
}

/* A cover is one page across the spread, so no gutter */
.epubier .ep-viewer.ep-spread.ep-cover::after {
  display: none;
}

/* Turning a page (turn in reader.js), a view transition of the page, named
   ep-turning-page while it turns: it slides off to the left, uncovering the
   next, or the one before slides in from the left over it. The page shown
   underneath is live, so it finishes drawing as the other slides. */
:active-view-transition-type(ep-turn)::view-transition {
  /* Taps and clicks go on to the reader, to turn again */
  pointer-events: none;
}

::view-transition-image-pair(ep-turning-page) {
  /* Kept to the page's own place, but for its shadow above and below */
  clip-path: inset(-1rem -1rem -1rem 0);
}

::view-transition-old(ep-turning-page),
::view-transition-new(ep-turning-page) {
  animation: none;
  mix-blend-mode: normal;
}

:active-view-transition-type(ep-turn-next)::view-transition-old(ep-turning-page) {
  z-index: 1;
  animation: ep-slide-off 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
}

:active-view-transition-type(ep-turn-prev)::view-transition-new(ep-turning-page) {
  animation: ep-slide-on 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
}

/* The page underneath is in the shadow of the one over it: lit as it's
   uncovered, or darkened as it's covered. Lightly on a light page, and more
   on a dark one, where darkening shows less. */
:active-view-transition-type(ep-turn)::view-transition {
  --ep-shade: 0.85;
}

:active-view-transition-type(ep-turn-dark)::view-transition {
  --ep-shade: 0.7;
}

:active-view-transition-type(ep-turn-next)::view-transition-new(ep-turning-page) {
  animation: ep-shade 0.3s cubic-bezier(0.4, 0, 0.2, 1) reverse both;
}

:active-view-transition-type(ep-turn-prev)::view-transition-old(ep-turning-page) {
  animation: ep-shade 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes ep-shade {
  from {
    filter: brightness(1);
  }
  to {
    filter: brightness(var(--ep-shade));
  }
}

@keyframes ep-slide-off {
  from {
    transform: none;
    box-shadow: 0 0 0 rgb(0 0 0 / 0);
  }
  to {
    transform: translateX(-100%);
    box-shadow: 6px 0 18px rgb(0 0 0 / 0.25);
  }
}

@keyframes ep-slide-on {
  from {
    transform: translateX(-100%);
    box-shadow: 6px 0 18px rgb(0 0 0 / 0.25);
  }
  to {
    transform: none;
    box-shadow: 0 0 0 rgb(0 0 0 / 0);
  }
}

/* Fixed pages (PDFs, comics), centred; a spread's pages meet in the middle */
.epubier .ep-pages {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Bigger than the screen, from the top left, so all of it can be scrolled to */
  align-items: safe center;
  justify-content: safe center;
}

.epubier .ep-pages.ep-zoomed {
  overflow: auto;
}

.epubier .ep-page {
  flex: none;
}

/* As a scroll: a column of pages, 8px apart (SCROLL_GAP in paged.js) */
.epubier .ep-pages.ep-scroll {
  display: block;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.epubier .ep-scroll .ep-page {
  margin: 0 auto 8px;
}

.epubier .ep-page > img,
.epubier .ep-page > canvas {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.epubier .ep-page:first-child:not(:last-child) > img {
  object-position: right center;
}

.epubier .ep-page:last-child:not(:first-child) > img {
  object-position: left center;
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
.epubier.ep-immersive.ep-counting-pages .ep-corner-info::before {
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
  .epubier.ep-immersive.ep-counting-pages .ep-corner-info::before {
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

.epubier.ep-immersive.ep-counting-pages .ep-corner-info::before {
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

/* Panels cover the toolbar, so their headers keep clear of the same things */
.epubier .ep-panel.ep-left .ep-panel-header {
  padding-left: calc(1rem + var(--ep-toolbar-inset-left, 0px));
}

.epubier .ep-panel.ep-right .ep-panel-header {
  padding-right: calc(0.5rem + var(--ep-toolbar-inset-right, 0px));
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

.epubier .ep-bookmark-note {
  border-left-color: var(--ep-accent);
}

.epubier .ep-where svg {
  width: 0.85rem;
  height: 0.85rem;
  margin-right: 0.3rem;
  vertical-align: -0.1rem;
  color: var(--ep-accent);
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

/* Settings */

.epubier .ep-settings {
  padding: 0.5rem 1rem 1rem;
  overflow-y: auto;
}

.epubier .ep-settings h3 {
  margin: 0.5rem 0 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ep-muted);
}

.epubier .ep-settings section + section {
  margin-top: 1.5rem;
}

.epubier .ep-option {
  position: relative;
  cursor: pointer;
}

.epubier .ep-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.epubier .ep-option input:checked ~ .ep-option-name {
  color: var(--ep-ink);
  font-weight: 600;
}

/* Themes: a row of small pages */

.epubier .ep-themes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
  gap: 0.75rem;
}

.epubier .ep-themes .ep-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--ep-muted);
  text-align: center;
}

.epubier .ep-theme-swatch {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 3 / 4;
  border: 1px solid var(--ep-line);
  border-radius: 6px;
  font-family: Georgia, serif;
  font-size: 1.3rem;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
}

.epubier .ep-themes input:checked ~ .ep-theme-swatch {
  outline: 2px solid var(--ep-accent);
  outline-offset: 2px;
}

.epubier .ep-themes input:focus-visible ~ .ep-theme-swatch {
  outline: 2px solid var(--ep-ink);
  outline-offset: 2px;
}

/* Fonts: a list, each name in its own font */

.epubier .ep-fonts {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ep-line);
  border-radius: 6px;
  overflow: hidden;
}

.epubier .ep-fonts .ep-option {
  display: flex;
  align-items: center;
  padding: 0.65rem 0.75rem;
  color: var(--ep-muted);
  font-size: 1.05rem;
}

.epubier .ep-fonts .ep-option + .ep-option {
  border-top: 1px solid var(--ep-line);
}

.epubier .ep-fonts .ep-option:hover,
.epubier .ep-fonts .ep-option:has(input:focus-visible) {
  background: var(--ep-bg);
}

.epubier .ep-fonts .ep-option:has(input:checked)::after {
  content: "";
  width: 0.4rem;
  height: 0.75rem;
  margin: 0 0.25rem 0.2rem auto;
  border: solid var(--ep-accent);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* Text size: smaller, the current size (which resets it), larger */

.epubier .ep-text-size {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  border: 1px solid var(--ep-line);
  border-radius: 6px;
  overflow: hidden;
}

.epubier .ep-text-size button {
  margin: 0;
  padding: 0.5rem;
  border: none;
  background: none;
  color: var(--ep-ink);
  font-family: Georgia, serif;
  cursor: pointer;
}

.epubier .ep-text-size button + button {
  border-left: 1px solid var(--ep-line);
}

.epubier .ep-text-size button:hover:not(:disabled),
.epubier .ep-text-size button:focus-visible {
  background: var(--ep-bg);
}

.epubier .ep-text-size button:disabled {
  color: var(--ep-line);
  cursor: default;
}

.epubier .ep-text-smaller {
  font-size: 0.85rem;
}

.epubier .ep-text-larger {
  font-size: 1.4rem;
}

.epubier .ep-zoom button {
  font-family: inherit;
  font-size: 1.15rem;
}

.epubier .ep-text-size .ep-text-size-value,
.epubier .ep-zoom .ep-zoom-value {
  font-family: inherit;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

/* Alignment and layout: rows of buttons */

.epubier .ep-aligns,
.epubier .ep-flows,
.epubier .ep-turns {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--ep-line);
  border-radius: 6px;
  overflow: hidden;
}

.epubier .ep-flows,
.epubier .ep-turns {
  grid-template-columns: repeat(2, 1fr);
}

/* A scroll has no pages to turn */
.epubier.ep-scrolled .ep-turn-settings {
  display: none;
}

.epubier .ep-aligns .ep-option,
.epubier .ep-flows .ep-option,
.epubier .ep-turns .ep-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.25rem;
  font-size: 0.75rem;
  color: var(--ep-muted);
}

.epubier .ep-aligns .ep-option + .ep-option,
.epubier .ep-flows .ep-option + .ep-option,
.epubier .ep-turns .ep-option + .ep-option {
  border-left: 1px solid var(--ep-line);
}

.epubier .ep-aligns .ep-option:hover,
.epubier .ep-aligns .ep-option:has(input:focus-visible),
.epubier .ep-flows .ep-option:hover,
.epubier .ep-flows .ep-option:has(input:focus-visible),
.epubier .ep-turns .ep-option:hover,
.epubier .ep-turns .ep-option:has(input:focus-visible) {
  background: var(--ep-bg);
}

.epubier .ep-aligns .ep-option:has(input:checked),
.epubier .ep-flows .ep-option:has(input:checked),
.epubier .ep-turns .ep-option:has(input:checked) {
  background: color-mix(in srgb, var(--ep-accent) 14%, transparent);
  color: var(--ep-ink);
}

.epubier .ep-align-icon svg,
.epubier .ep-option-icon svg {
  display: block;
  width: 1.3rem;
  height: 1.3rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Highlights are blended with the page: darkening on a light page,
   lightening on a dark one */
.epubier.ep-dark .ep-viewer svg g {
  mix-blend-mode: screen;
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
  color: #24231f;
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
}

/* ---------- Immersive ---------- */

/* In fullscreen, and by default on phones and tablets: the page fills the
   reader, and the toolbars float over it, shown by a tap in the middle */
.epubier.ep-immersive {
  background: var(--ep-page);
  /* Toolbars float over the page, so only the reader is in the flow */
  grid-template-rows: minmax(0, 1fr);
}

.epubier.ep-immersive .ep-toolbar,
.epubier.ep-immersive .ep-footer {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 5;
  background: var(--ep-bg);
  box-shadow: 0 0 12px rgb(0 0 0 / 0.2);
  transition: transform 0.2s ease-out;
}

.epubier.ep-immersive .ep-toolbar {
  top: 0;
  transform: translateY(-110%);
  padding-top: max(0.4rem, env(safe-area-inset-top));
  padding-left: calc(max(0.5rem, env(safe-area-inset-left)) + var(--ep-toolbar-inset-left, 0px));
  padding-right: calc(max(0.5rem, env(safe-area-inset-right)) + var(--ep-toolbar-inset-right, 0px));
}

.epubier.ep-immersive .ep-footer {
  bottom: 0;
  transform: translateY(110%);
  padding-top: 0.6rem;
  padding-bottom: max(0.6rem, env(safe-area-inset-bottom));
}

.epubier.ep-immersive.ep-show-controls .ep-toolbar,
.epubier.ep-immersive.ep-show-controls .ep-footer {
  transform: none;
}

.epubier.ep-immersive .ep-reader {
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
    calc(1.4rem + env(safe-area-inset-bottom)) env(safe-area-inset-left);
}

.epubier.ep-immersive .ep-arrow {
  display: none;
}

.epubier.ep-immersive .ep-viewer {
  border-radius: 0;
  box-shadow: none;
}

.epubier.ep-immersive .ep-corner-info {
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

.epubier.ep-immersive.ep-show-controls .ep-corner-info {
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

/* Phones in portrait: the page takes the full width. Swipes turn pages, and
   so do taps on its outer thirds (see onTap in reader.js). */
@media (pointer: coarse) and (orientation: portrait) {
  .epubier .ep-arrow {
    display: none;
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
  for (const [property, value] of styleProperties(styles)) {
    root.style.setProperty(property, value);
  }
}

/** `styles` as [custom property, value] pairs, skipping (and warning about) unknown names */
export function styleProperties(styles = {}) {
  const properties = [];
  for (const [key, value] of Object.entries(styles)) {
    const property = key.startsWith("--") ? key : THEME_VARIABLES[key];
    if (!property) {
      console.warn(`epubier: unknown style "${key}"; expected one of ${Object.keys(THEME_VARIABLES).join(", ")} or a --custom-property`);
      continue;
    }
    properties.push([property, value]);
  }
  return properties;
}
