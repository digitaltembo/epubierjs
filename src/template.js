import { icons } from "./icons.js";

const escapeHtml = (text) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * The reader's markup. Everything is found by `ep-` class within the reader,
 * so several readers can share a page; ids exist only for aria-controls and
 * are prefixed with `uid`. Its text is from `t` (see strings.js).
 */
export const template = (uid, t) => {
  const s = (key, vars) => escapeHtml(t(key, vars));
  return `
<div class="ep-toolbar">
  <button type="button" class="ep-tool ep-back" title="${s("toolbar.back")}" aria-label="${s("toolbar.back")}" hidden>${icons.back}</button>
  <button type="button" class="ep-tool ep-toc-button" title="${s("toolbar.contents")}"
    aria-label="${s("toolbar.contents")}" aria-controls="${uid}-toc-panel">${icons.list}</button>
  <div class="ep-book-info">
    <div class="ep-book-title">${s("loading")}</div>
    <div class="ep-chapter"></div>
  </div>
  <button type="button" class="ep-tool ep-bookmark-button" title="${s("toolbar.bookmark")} (B)"
    aria-label="${s("toolbar.bookmark")}" aria-pressed="false">${icons.bookmark}</button>
  <button type="button" class="ep-tool ep-fullscreen-button" title="${s("toolbar.fullscreen")} (F)"
    aria-label="${s("toolbar.fullscreen")}" aria-pressed="false">
    <span class="ep-enter">${icons.fullscreenEnter}</span><span class="ep-exit">${icons.fullscreenExit}</span>
  </button>
  <button type="button" class="ep-tool ep-share-button" title="${s("toolbar.share")}"
    aria-label="${s("toolbar.share")}">${icons.share}</button>
  <button type="button" class="ep-tool ep-search-button" title="${s("toolbar.search")}" aria-label="${s("toolbar.search")}"
    aria-controls="${uid}-search-panel">${icons.search}</button>
</div>

<div class="ep-reader">
  <button type="button" class="ep-arrow ep-prev" aria-label="${s("navigation.previousPage")}">‹</button>
  <div class="ep-viewer">
    <div class="ep-loading ep-spinner" role="status" aria-label="${s("loadingBook")}"></div>
  </div>
  <button type="button" class="ep-arrow ep-next" aria-label="${s("navigation.nextPage")}">›</button>
</div>

<div class="ep-footer">
  <input class="ep-progress" type="range" min="0" max="1000" value="0" aria-label="${s("navigation.position")}" disabled />
  <div class="ep-status-line">
    <span class="ep-counting ep-spinner" aria-hidden="true"></span>
    <span class="ep-page-info" aria-live="polite"></span>
  </div>
</div>

<div class="ep-corner-info" aria-hidden="true"></div>
<div class="ep-toast" role="status" aria-live="polite"></div>
<div class="ep-scrim" hidden></div>

<div id="${uid}-toc-panel" class="ep-panel ep-left ep-toc-panel" role="dialog"
  aria-label="${s("toolbar.contents")}" inert>
  <div class="ep-panel-header">
    <div class="ep-tabs" role="tablist">
      <button type="button" role="tab" aria-selected="true" aria-controls="${uid}-toc">${s("panel.contents")}</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="${uid}-notes">${s("panel.notes")}</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="${uid}-settings">${s("panel.settings")}</button>
    </div>
    <button type="button" class="ep-tool ep-close" aria-label="${s("panel.close")}">${icons.close}</button>
  </div>
  <nav id="${uid}-toc" class="ep-toc" role="tabpanel"></nav>
  <ol id="${uid}-notes" class="ep-note-list" role="tabpanel" aria-label="${s("notes.label")}" hidden></ol>
  <div id="${uid}-settings" class="ep-settings" role="tabpanel" hidden>
    <section class="ep-theme-settings">
      <h3 id="${uid}-theme-label">${s("settings.theme")}</h3>
      <div class="ep-themes" role="radiogroup" aria-labelledby="${uid}-theme-label"></div>
    </section>
    <section class="ep-flow-settings">
      <h3 id="${uid}-flow-label">${s("settings.layout")}</h3>
      <div class="ep-flows" role="radiogroup" aria-labelledby="${uid}-flow-label"></div>
    </section>
    <section class="ep-turn-settings">
      <h3 id="${uid}-turn-label">${s("settings.pageTurn")}</h3>
      <div class="ep-turns" role="radiogroup" aria-labelledby="${uid}-turn-label"></div>
    </section>
    <section class="ep-font-settings">
      <h3 id="${uid}-font-label">${s("settings.font")}</h3>
      <div class="ep-fonts" role="radiogroup" aria-labelledby="${uid}-font-label"></div>
    </section>
    <section class="ep-size-settings">
      <h3 id="${uid}-size-label">${s("settings.textSize")}</h3>
      <div class="ep-text-size" role="group" aria-labelledby="${uid}-size-label">
        <button type="button" class="ep-text-smaller" aria-label="${s("settings.smallerText")}" title="${s("settings.smallerText")}">A</button>
        <button type="button" class="ep-text-size-value" aria-live="polite" title="${s("settings.resetTextSize")}">${s("percent", { percent: 100 })}</button>
        <button type="button" class="ep-text-larger" aria-label="${s("settings.largerText")}" title="${s("settings.largerText")}">A</button>
      </div>
    </section>
    <section class="ep-zoom-settings">
      <h3 id="${uid}-zoom-label">${s("settings.zoom")}</h3>
      <div class="ep-text-size ep-zoom" role="group" aria-labelledby="${uid}-zoom-label">
        <button type="button" class="ep-zoom-out" aria-label="${s("settings.zoomOut")}" title="${s("settings.zoomOut")}">−</button>
        <button type="button" class="ep-zoom-value" aria-live="polite" title="${s("settings.resetZoom")}">${s("percent", { percent: 100 })}</button>
        <button type="button" class="ep-zoom-in" aria-label="${s("settings.zoomIn")}" title="${s("settings.zoomIn")}">+</button>
      </div>
    </section>
    <section class="ep-align-settings">
      <h3 id="${uid}-align-label">${s("settings.align")}</h3>
      <div class="ep-aligns" role="radiogroup" aria-labelledby="${uid}-align-label"></div>
    </section>
  </div>
</div>

<div class="ep-selection-menu" role="toolbar" aria-label="${s("highlight.menu")}" hidden>
  <button type="button" class="ep-swatch" data-color="yellow" aria-label="${s("highlight.colors.yellow")}"></button>
  <button type="button" class="ep-swatch" data-color="green" aria-label="${s("highlight.colors.green")}"></button>
  <button type="button" class="ep-swatch" data-color="blue" aria-label="${s("highlight.colors.blue")}"></button>
  <button type="button" class="ep-swatch" data-color="pink" aria-label="${s("highlight.colors.pink")}"></button>
  <button type="button" class="ep-tool ep-share-highlight" title="${s("highlight.share")}"
    aria-label="${s("highlight.share")}">${icons.share}</button>
  <button type="button" class="ep-tool ep-remove-highlight" title="${s("highlight.remove")}"
    aria-label="${s("highlight.remove")}">${icons.trash}</button>
</div>

<div id="${uid}-search-panel" class="ep-panel ep-right ep-search-panel" role="dialog" aria-label="${s("search.title")}" inert>
  <div class="ep-panel-header">
    <h2>${s("search.title")}</h2>
    <button type="button" class="ep-tool ep-close" aria-label="${s("panel.close")}">${icons.close}</button>
  </div>
  <form class="ep-search-form">
    <input class="ep-search-input" type="search" placeholder="${s("search.placeholder")}" aria-label="${s("search.placeholder")}" />
  </form>
  <p class="ep-search-status"></p>
  <ol class="ep-search-results"></ol>
</div>
`;
};
