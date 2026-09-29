import { icons } from "./icons.js";

/**
 * The reader's markup. Everything is found by `ep-` class within the reader,
 * so several readers can share a page; ids exist only for aria-controls and
 * are prefixed with `uid`.
 */
export const template = (uid) => `
<div class="ep-toolbar">
  <button type="button" class="ep-tool ep-back" title="Back" aria-label="Back" hidden>${icons.back}</button>
  <button type="button" class="ep-tool ep-toc-button" title="Contents, bookmarks &amp; highlights"
    aria-label="Contents, bookmarks and highlights" aria-controls="${uid}-toc-panel">${icons.list}</button>
  <div class="ep-book-info">
    <div class="ep-book-title">Loading…</div>
    <div class="ep-chapter"></div>
  </div>
  <button type="button" class="ep-tool ep-bookmark-button" title="Bookmark this page (B)"
    aria-label="Bookmark this page" aria-pressed="false">${icons.bookmark}</button>
  <button type="button" class="ep-tool ep-fullscreen-button" title="Fullscreen (F)"
    aria-label="Fullscreen" aria-pressed="false">
    <span class="ep-enter">${icons.fullscreenEnter}</span><span class="ep-exit">${icons.fullscreenExit}</span>
  </button>
  <button type="button" class="ep-tool ep-share-button" title="Share a link to this page"
    aria-label="Share a link to this page">${icons.share}</button>
  <button type="button" class="ep-tool ep-search-button" title="Search" aria-label="Search"
    aria-controls="${uid}-search-panel">${icons.search}</button>
</div>

<div class="ep-reader">
  <button type="button" class="ep-arrow ep-prev" aria-label="Previous page">‹</button>
  <div class="ep-viewer">
    <div class="ep-loading ep-spinner" role="status" aria-label="Loading book"></div>
  </div>
  <button type="button" class="ep-arrow ep-next" aria-label="Next page">›</button>
</div>

<div class="ep-footer">
  <input class="ep-progress" type="range" min="0" max="1000" value="0" aria-label="Position in book" disabled />
  <div class="ep-status-line">
    <span class="ep-counting ep-spinner" aria-hidden="true"></span>
    <span class="ep-page-info" aria-live="polite"></span>
  </div>
</div>

<div class="ep-corner-info" aria-hidden="true"></div>
<div class="ep-toast" role="status" aria-live="polite"></div>
<div class="ep-scrim" hidden></div>

<div id="${uid}-toc-panel" class="ep-panel ep-left ep-toc-panel" role="dialog"
  aria-label="Contents, bookmarks and highlights" inert>
  <div class="ep-panel-header">
    <div class="ep-tabs" role="tablist">
      <button type="button" role="tab" aria-selected="true" aria-controls="${uid}-toc">Contents</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="${uid}-bookmarks">Bookmarks</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="${uid}-highlights">Highlights</button>
    </div>
    <button type="button" class="ep-tool ep-close" aria-label="Close">${icons.close}</button>
  </div>
  <nav id="${uid}-toc" class="ep-toc" role="tabpanel"></nav>
  <ol id="${uid}-bookmarks" class="ep-note-list ep-bookmark-list" role="tabpanel" hidden></ol>
  <ol id="${uid}-highlights" class="ep-note-list ep-highlight-list" role="tabpanel" hidden></ol>
</div>

<div class="ep-selection-menu" role="toolbar" aria-label="Highlight" hidden>
  <button type="button" class="ep-swatch" data-color="yellow" aria-label="Yellow highlight"></button>
  <button type="button" class="ep-swatch" data-color="green" aria-label="Green highlight"></button>
  <button type="button" class="ep-swatch" data-color="blue" aria-label="Blue highlight"></button>
  <button type="button" class="ep-swatch" data-color="pink" aria-label="Pink highlight"></button>
  <button type="button" class="ep-tool ep-share-highlight" title="Share a link to this passage"
    aria-label="Share a link to this passage">${icons.share}</button>
  <button type="button" class="ep-tool ep-remove-highlight" title="Remove highlight"
    aria-label="Remove highlight">${icons.trash}</button>
</div>

<div id="${uid}-search-panel" class="ep-panel ep-right ep-search-panel" role="dialog" aria-label="Search" inert>
  <div class="ep-panel-header">
    <h2>Search</h2>
    <button type="button" class="ep-tool ep-close" aria-label="Close">${icons.close}</button>
  </div>
  <form class="ep-search-form">
    <input class="ep-search-input" type="search" placeholder="Search this book" aria-label="Search this book" />
  </form>
  <p class="ep-search-status"></p>
  <ol class="ep-search-results"></ol>
</div>
`;
