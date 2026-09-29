import ePub from "epubjs";
import { store, storageKeys } from "./storage.js";
import { shareLink } from "./share.js";
import { resolveThemes, DEFAULT_THEME } from "./themes.js";
import { resolveFonts, previewUrl, DEFAULT_FONT } from "./fonts.js";
import { styleProperties } from "./styles.js";

const HIGHLIGHT_COLORS = {
  yellow: "#fde047",
  green: "#86efac",
  blue: "#93c5fd",
  pink: "#f9a8d4",
};
/** Theme choice, shared by every book */
const THEME_KEY = "epubier-theme";
/** Font choice, shared by every book */
const FONT_KEY = "epubier-font";
/** Text alignment choice, shared by every book */
const ALIGN_KEY = "epubier-align";
/** Text size choice (a percentage of the book's own), shared by every book */
const SIZE_KEY = "epubier-text-size";
const TEXT_SIZES = [70, 80, 90, 100, 110, 120, 135, 150, 175, 200];
/** Text alignments, in the order the settings tab lists them */
const ALIGNMENTS = {
  justify: { label: "Justified", value: "justify" },
  left: { label: "Left", value: "left" },
  right: { label: "Right", value: "right" },
  original: { label: "Original", value: null },
};

/** Lines of text aligned as `value`, or a book for the book's own alignment */
function alignIcon(value) {
  const span = document.createElement("span");
  span.className = "ep-align-icon";
  span.setAttribute("aria-hidden", "true");
  const lines = [20, 14, 20, 10].map((width, i) => {
    const full = value === "justify" && i < 3 ? 20 : width;
    const x = value === "right" ? 22 - full : 2;
    return `<path d="M${x} ${5 + i * 5}h${full}" />`;
  });
  span.innerHTML = value
    ? `<svg viewBox="0 0 24 24">${lines.join("")}</svg>`
    : `<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 21a2 2 0 0 0 2 2h14v-4" /></svg>`;
  return span;
}
const SHARED_PASSAGE_STYLE = { fill: "#fb923c", "fill-opacity": "0.35", "mix-blend-mode": "multiply" };

/**
 * Runs the reader inside `root`, which already contains the template.
 *
 * @param {HTMLElement} root
 * @param {string} url of the .epub
 * @param {{onBackPressed?: () => void}} opts
 */
export function createReader(root, url, opts) {
  const $ = (name) => root.querySelector(".ep-" + name);
  /** Listeners on window/document, removed by destroy() */
  const cleanups = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };

  const bookTitle = $("book-title"),
    chapter = $("chapter"),
    pageInfo = $("page-info"),
    progress = $("progress"),
    viewer = $("viewer"),
    tocPanel = $("toc-panel"),
    searchPanel = $("search-panel"),
    scrim = $("scrim"),
    toolbar = $("toolbar"),
    footer = $("footer"),
    selectionMenu = $("selection-menu");

  root.classList.add("ep-loading-book", "ep-counting-pages");

  const back = $("back");
  if (opts.onBackPressed) {
    back.hidden = false;
    back.onclick = () => opts.onBackPressed();
  }

  function showError(title, message) {
    root.classList.remove("ep-loading-book", "ep-counting-pages");
    bookTitle.textContent = title;
    const text = document.createElement("p");
    text.className = "ep-message";
    text.textContent = message;
    viewer.replaceChildren(text);
  }

  if (!url) {
    showError("No book specified", "No ePub was given to read.");
    return { book: null, rendition: null, destroy() {} };
  }

  const book = ePub(url);
  const rendition = book.renderTo(viewer, {
    width: "100%",
    height: "100%",
    flow: "paginated",
    spread: "auto",
    minSpreadWidth: 900,
  });

  rendition.themes.default({
    "::selection": { background: "rgba(255, 220, 0, 0.35)" },
    ".epubjs-hl": { fill: "yellow", "fill-opacity": "0.4", "mix-blend-mode": "multiply" },
  });

  // Some books (e.g. Standard Ebooks title pages) hide text for screen
  // readers by positioning it far off-screen, which epub.js counts as
  // content and turns into dozens of blank pages. Hide those instead.
  rendition.hooks.content.register((contents) => {
    const win = contents.window;
    let hidden = false;
    for (const el of contents.document.body.querySelectorAll("*")) {
      const position = win.getComputedStyle(el).position;
      if ((position === "absolute" || position === "fixed") && el.getBoundingClientRect().right < 0) {
        el.style.display = "none";
        hidden = true;
      }
    }
    // Re-measure the chapter now that it is shorter
    if (hidden) contents.expand();
  });

  /* ---------- Settings: theme, font and alignment ---------- */

  // A theme sets the reader's custom properties on top of `styles`, and
  // colors the book's own text to match. A font replaces the book's own,
  // and an alignment applies to the book's ordinary paragraphs.
  const themes = resolveThemes(opts.themes),
    fonts = resolveFonts(opts.fonts);
  const baseProperties = new Map(styleProperties(opts.styles));
  const rootStyle = getComputedStyle(root);
  // Colors without any theme, for the White theme's swatch
  const baseColors = {
    page: rootStyle.getPropertyValue("--ep-page").trim(),
    text: rootStyle.getPropertyValue("--ep-ink").trim(),
  };
  let theme = null,
    themeCss = "",
    font = null,
    align = null,
    textSize = 100;

  function isDarkColor(color) {
    const [r, g, b] = (color.match(/[\d.]+/g) || [255, 255, 255]).map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  }

  /** The book's CSS for the current settings */
  function bookCss() {
    const fontCss = font?.family
      ? `body, body *:not(code):not(pre):not(kbd):not(samp) { font-family: ${font.family} !important; }`
      : "";
    // Justified text is hyphenated. That's set on the whole book up front
    // (rather than with the alignment, which applies once a chapter is
    // shown), so that aligning changes no line breaks and so no pages.
    const alignCss = ALIGNMENTS[align]?.value
      ? `[data-ep-align] { text-align: ${ALIGNMENTS[align].value} !important; }
        ${align === "justify" ? "body { hyphens: auto; -webkit-hyphens: auto; }" : ""}`
      : "";
    // Books size their text relative to the root (em, rem, %), so scaling
    // the root scales the book
    const sizeCss = textSize !== 100 ? `html { font-size: ${textSize}% !important; }` : "";
    return themeCss + fontCss + alignCss + sizeCss;
  }

  /** Adds (or updates) the settings' styles and font stylesheet in a book document */
  function addStyles(doc) {
    const head = doc.getElementsByTagName("head")[0];
    if (!head) return;
    let style = doc.getElementById("epubier-style"),
      link = doc.getElementById("epubier-font");
    if (!style) {
      style = doc.createElement("style");
      style.setAttribute("id", "epubier-style");
      head.appendChild(style);
    }
    style.textContent = bookCss();
    if (font?.url) {
      if (!link) {
        link = doc.createElement("link");
        link.setAttribute("id", "epubier-font");
        link.setAttribute("rel", "stylesheet");
        head.insertBefore(link, style);
      }
      if (link.getAttribute("href") !== font.url) {
        link.loaded = new Promise((resolve) => (link.onload = link.onerror = resolve));
        link.setAttribute("href", font.url);
      }
    } else {
      link?.remove();
    }
    return link;
  }

  // Each chapter gets the styles before epub.js lays it out and finds the
  // place to show; styles added once it's shown would move the text
  book.spine.hooks.content.register((doc) => {
    addStyles(doc);
  });

  /**
   * Updates the styles in a chapter that's already shown. Resolves once the
   * font has loaded (or after 3 seconds).
   */
  function styleContents(contents) {
    const doc = contents.document;
    markAlignable(doc);
    const link = addStyles(doc);
    const family = font?.family;
    return Promise.race([
      Promise.resolve(link?.loaded)
        .then(() => family && doc.fonts.load(`1em ${family}`))
        .then(() => doc.fonts.ready)
        .catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }

  /**
   * Loads a font in the page itself. Chapters then find it in the browser's
   * cache, so it's usually ready by the time they're laid out.
   */
  const pageFontLinks = new Map();
  function preloadFont(f) {
    if (!f?.url) return Promise.resolve();
    if (!pageFontLinks.has(f.url)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = f.url;
      document.head.appendChild(link);
      pageFontLinks.set(f.url, {
        link,
        loaded: new Promise((resolve) => (link.onload = link.onerror = resolve)).then(() =>
          document.fonts.load(`1em ${f.family}`).catch(() => {}),
        ),
      });
    }
    return Promise.race([pageFontLinks.get(f.url).loaded, new Promise((resolve) => setTimeout(resolve, 3000))]);
  }
  cleanups.push(() => pageFontLinks.forEach(({ link }) => link.remove()));

  /**
   * Marks the text blocks whose alignment the setting may change: those
   * aligned the ordinary way (to the start, or justified). Anything the book
   * centers or aligns to the other side, like headings, title pages and
   * attributions, keeps its alignment.
   */
  function markAlignable(doc) {
    if (!doc.body || doc.body.hasAttribute("data-ep-aligned")) return;
    doc.body.setAttribute("data-ep-aligned", "");
    const win = doc.defaultView;
    for (const el of doc.body.querySelectorAll("p, li, dd, dt, blockquote, div")) {
      const style = win.getComputedStyle(el);
      const start = style.direction === "rtl" ? "right" : "left";
      if (["start", "justify", start].includes(style.textAlign)) el.setAttribute("data-ep-align", "");
    }
  }

  const restyle = () => Promise.all(rendition.getContents().map(styleContents));

  function applyTheme(id) {
    for (const [property] of theme?.properties || []) {
      if (baseProperties.has(property)) root.style.setProperty(property, baseProperties.get(property));
      else root.style.removeProperty(property);
    }
    theme = themes[id];
    for (const [property, value] of theme.properties) root.style.setProperty(property, value);

    const text = rootStyle.color,
      accent = rootStyle.getPropertyValue("--ep-accent").trim();
    const dark = theme.dark ?? isDarkColor(getComputedStyle(viewer).backgroundColor);
    root.classList.toggle("ep-dark", dark);
    // The page color shows through the book; on a dark page, text the book
    // colors itself (usually black) would be unreadable, so it's all recolored
    themeCss = `
      html, body { color: ${text} !important; background: transparent !important; }
      ${dark ? `body *:not(a) { color: inherit !important; background-color: transparent !important; }
      a, a * { color: ${accent} !important; }` : ""}`;
    restyle();
    checkOption("themes", id);
  }

  // Where to return to after the text reflows (a new font or alignment).
  // Kept through consecutive changes, so that switching back and forth
  // doesn't creep backwards: the old screen's start usually lands partway
  // into the new screen.
  let reflowAnchor = null,
    reflows = 0;

  /** Restyles the book, and afterwards goes back to the same place in it */
  async function reflow() {
    // rendition.location lags a moment behind the screen, e.g. just after
    // the last reflow; ask for where the screen is directly
    const start = rendition.manager && rendition.currentLocation()?.start?.cfi;
    const cfi = start && (reflowAnchor?.landing === start ? reflowAnchor.cfi : start);
    const current = ++reflows;
    await restyle();
    if (!cfi) return;
    if (current !== reflows) return; // changed again meanwhile
    // Re-measure the text now, rather than whenever epub.js notices, so the
    // position is looked up in the new layout
    rendition.views().forEach?.((view) => view.expand());
    await rendition.display(cfi);
    reflowAnchor = { cfi, landing: rendition.currentLocation()?.start?.cfi };
  }

  function applyFont(id) {
    font = fonts[id];
    checkOption("fonts", id);
    preloadFont(font);
    reflow();
  }

  function applyTextSize(size) {
    textSize = size;
    const i = TEXT_SIZES.indexOf(size);
    $("text-size-value").textContent = `${size}%`;
    $("text-smaller").disabled = i <= 0;
    $("text-larger").disabled = i >= TEXT_SIZES.length - 1;
    reflow();
  }
  function stepTextSize(step) {
    const i = TEXT_SIZES.indexOf(textSize) + step;
    if (i < 0 || i >= TEXT_SIZES.length) return;
    applyTextSize(TEXT_SIZES[i]);
    store.set(SIZE_KEY, String(TEXT_SIZES[i]));
  }
  $("text-smaller").onclick = () => stepTextSize(-1);
  $("text-larger").onclick = () => stepTextSize(1);
  $("text-size-value").onclick = () => {
    applyTextSize(100);
    store.set(SIZE_KEY, "100");
  };

  function applyAlign(id) {
    align = id;
    checkOption("aligns", id);
    reflow();
  }

  function checkOption(list, id) {
    for (const input of $(list).querySelectorAll("input")) input.checked = input.value === id;
  }

  /** A radio button in the settings tab, which applies and saves a choice */
  function addOption(list, id, label, key, apply) {
    const option = document.createElement("label"),
      input = document.createElement("input"),
      name = document.createElement("span");
    option.className = "ep-option";
    input.type = "radio";
    input.name = `${tocPanel.id}-${list}`;
    input.value = id;
    input.onchange = () => {
      apply(id);
      store.set(key, id);
    };
    name.className = "ep-option-name";
    name.textContent = label;
    option.append(input, name);
    $(list).appendChild(option);
    return option;
  }

  const choose = (options, key, fallback) =>
    [store.get(key), fallback.opt, fallback.default].find((id) => id && options[id]) || Object.keys(options)[0];

  for (const [id, t] of Object.entries(themes)) {
    const option = addOption("themes", id, t.label, THEME_KEY, applyTheme);
    const swatch = document.createElement("span");
    swatch.className = "ep-theme-swatch";
    swatch.setAttribute("aria-hidden", "true");
    swatch.textContent = "Aa";
    const values = Object.fromEntries(t.properties);
    swatch.style.background = values["--ep-page"] || baseColors.page;
    swatch.style.color = values["--ep-ink"] || baseColors.text;
    option.querySelector("input").after(swatch);
  }
  for (const [id, f] of Object.entries(fonts)) {
    const option = addOption("fonts", id, f.label, FONT_KEY, applyFont);
    if (f.family) option.querySelector(".ep-option-name").style.fontFamily = f.family;
  }

  for (const [id, a] of Object.entries(ALIGNMENTS)) {
    const option = addOption("aligns", id, a.label, ALIGN_KEY, applyAlign);
    option.querySelector("input").after(alignIcon(a.value));
  }

  // Each font's name is shown in that font, loaded when the settings tab is
  // first opened rather than with the reader
  let previewLinks = null;
  function loadFontPreviews() {
    if (previewLinks) return;
    previewLinks = Object.values(fonts)
      .map(previewUrl)
      .filter(Boolean)
      .map((href) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
        return link;
      });
  }
  cleanups.push(() => previewLinks?.forEach((link) => link.remove()));

  $("theme-settings").hidden = Object.keys(themes).length < 2;
  $("font-settings").hidden = Object.keys(fonts).length < 2;
  const settingsTab = tocPanel.querySelector(`[aria-controls="${$("settings").id}"]`);

  rendition.hooks.content.register(styleContents);
  if (Object.keys(themes).length) applyTheme(choose(themes, THEME_KEY, { opt: opts.theme, default: DEFAULT_THEME }));
  if (Object.keys(fonts).length) applyFont(choose(fonts, FONT_KEY, { opt: opts.font, default: DEFAULT_FONT }));
  applyAlign(choose(ALIGNMENTS, ALIGN_KEY, { opt: opts.align, default: "justify" }));
  applyTextSize(
    [Number(store.get(SIZE_KEY)), Number(opts.textSize), 100].find((size) => TEXT_SIZES.includes(size)),
  );

  const keys = storageKeys(url);

  /* ---------- State ---------- */

  /** Whether page numbers (the locations index) are available yet */
  let locationsReady = false,
    /** Page just jumped to, kept as the page number for the screen it lands on */
    requestedPage = null,
    /** Page to show once page numbers are ready */
    pendingPage = null,
    /** Temporary highlight of a passage someone shared */
    sharedPassage = null,
    bookName = "",
    /** What the highlight menu acts on: a new selection, or an existing highlight */
    menuTarget = null,
    menuWasOpen = false;

  /* ---------- Position in the URL ---------- */

  // The position lives in the hash as a page number, e.g. #loc=21, so a
  // link can point at a specific place in the book. Page numbers come
  // from the locations index, so a #loc link waits for that to be ready.
  // A shared passage adds its exact range as a CFI (without the
  // "epubcfi(…)" wrapper): #loc=21&hl=/6/6[ch01]!/4/2/150,/5:10,/5:42
  function parseHash() {
    const match = /^#loc=(\d+)(?:&hl=(.+))?$/.exec(location.hash);
    if (!match) return { page: null, passage: null };
    let passage = null;
    try {
      if (match[2]) passage = `epubcfi(${decodeURIComponent(match[2])})`;
    } catch (e) {}
    return { page: parseInt(match[1], 10), passage };
  }
  const baseUrl = () => location.origin + location.pathname + location.search;
  const pageLink = (page) => `${baseUrl()}#loc=${page}`;
  const passageLink = (cfi, page) =>
    `${pageLink(page)}&hl=${cfi.replace(/^epubcfi\((.*)\)$/, "$1").replace(/[%#& ]/g, encodeURIComponent)}`;

  function displayPage(page) {
    requestedPage = Math.min(Math.max(page, 1), book.locations.length());
    rendition.display(book.locations.cfiFromLocation(requestedPage - 1));
  }
  function goToPage(page) {
    if (locationsReady) displayPage(page);
    else pendingPage = page;
  }

  // A shared passage needs no page numbers, so show it straight away
  function showSharedPassage(cfi, page) {
    // Display the passage's start: a range here never finishes
    // displaying when the chapter isn't loaded yet
    let start;
    try {
      start = new ePub.CFI(cfi);
      start.collapse(true);
    } catch (e) {
      return goToPage(page);
    }
    rendition.display(start.toString()).then(
      () => {
        if (sharedPassage) rendition.annotations.remove(sharedPassage, "highlight");
        sharedPassage = cfi;
        rendition.annotations.highlight(
          cfi,
          {},
          (e) => {
            if (e.type !== "click") return;
            const range = rendition.getRange(cfi);
            if (range) showMenu(range, { cfi, text: range.toString(), shared: true });
          },
          "ep-shared-passage",
          SHARED_PASSAGE_STYLE,
        );
      },
      // Not a valid position in this book; fall back to the page
      () => goToPage(page),
    );
  }

  function followHash() {
    const { page, passage } = parseHash();
    if (passage) showSharedPassage(passage, page);
    else if (page !== null) goToPage(page);
    return page !== null;
  }
  // The first chapter shown waits (briefly) for the chosen font, so it's
  // laid out in it
  preloadFont(font).then(() => {
    if (root.isConnected && !followHash()) rendition.display(store.get(keys.position) || undefined);
  });
  // Hash edited by hand or a link followed within the page
  listen(window, "hashchange", followHash);

  book.opened.catch((error) => {
    console.error(error);
    showError("Could not open book", String(error.message || error));
  });

  book.loaded.metadata.then((meta) => {
    bookName = meta.title || "";
    const author = meta.creator ? ` — ${meta.creator}` : "";
    bookTitle.textContent = bookName + author;
  });

  // Two-page spreads get a faint gutter line
  rendition.on("layout", (layout) => {
    viewer.classList.toggle("ep-spread", layout.divisor === 2);
  });

  // epub.js only re-lays out on window resizes; the reader can also change
  // size on its own (host layout, fullscreen)
  let lastSize = "",
    resizeTimer = null;
  const resizeObserver = new ResizeObserver(([entry]) => {
    const size = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
    if (size === lastSize) return;
    const first = !lastSize;
    lastSize = size;
    if (first) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (rendition.manager) rendition.resize();
    }, 100);
  });
  resizeObserver.observe(viewer);
  cleanups.push(() => {
    resizeObserver.disconnect();
    clearTimeout(resizeTimer);
  });

  /* ---------- Navigation ---------- */

  const next = () => rendition.next(),
    prev = () => rendition.prev();
  $("next").onclick = next;
  $("prev").onclick = prev;

  function onKey(e) {
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
    // With several readers (or other widgets) on a page, only react when
    // nothing else has focus
    const active = document.activeElement;
    if (e.currentTarget === document && active && active !== document.body && !root.contains(active)) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") next();
    else if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
    else if (e.key === "f" || e.key === "F") setFullscreen(!isFullscreen());
    else if (e.key === "b" || e.key === "B") toggleBookmark();
    else if (e.key === "Escape") {
      if (!selectionMenu.hidden) hideMenu();
      else if (tocPanel.classList.contains("ep-open") || searchPanel.classList.contains("ep-open")) closePanels();
      else if (isFullscreen()) setFullscreen(false);
    }
  }
  listen(document, "keydown", onKey);
  rendition.on("keydown", onKey);

  /* ---------- Swipe & tap ---------- */

  // Touches inside the book's iframe come through the rendition, the
  // rest (including the margins around the page) from the reader area.
  // screenX/Y is comparable across both.
  let touchStart = null,
    lastSwipe = 0;
  const onTouchStart = (e) => {
    if (e.touches.length > 1) {
      touchStart = null; // pinch zoom, not a swipe
      return;
    }
    const t = e.changedTouches[0];
    touchStart = { x: t.screenX, y: t.screenY, time: Date.now() };
  };
  const onTouchEnd = (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.screenX - touchStart.x,
      dy = t.screenY - touchStart.y,
      elapsed = Date.now() - touchStart.time;
    touchStart = null;
    if (elapsed < 800 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      lastSwipe = Date.now();
      dx < 0 ? next() : prev();
    }
  };
  rendition.on("touchstart", onTouchStart);
  rendition.on("touchend", onTouchEnd);
  const readerArea = $("reader");
  readerArea.addEventListener("touchstart", onTouchStart, { passive: true });
  readerArea.addEventListener("touchend", onTouchEnd);

  // In fullscreen, tap the outer thirds to turn pages and the middle to
  // show or hide the controls. `x` is relative to the window.
  function onTap(x, target) {
    if (!isFullscreen() || Date.now() - lastSwipe < 500) return;
    if (target.closest && target.closest("a")) return;
    const bounds = root.getBoundingClientRect();
    const position = (x - bounds.left) / bounds.width;
    if (position < 0.3) {
      setControls(false);
      prev();
    } else if (position > 0.7) {
      setControls(false);
      next();
    } else {
      setControls(!root.classList.contains("ep-show-controls"));
    }
  }
  rendition.on("click", (e, contents) => {
    const selection = contents.window.getSelection();
    if (selection && !selection.isCollapsed) return;
    if (menuWasOpen) return; // this tap just dismissed the highlight menu
    // clientX is relative to the (very wide, scrolled) iframe
    const frame = contents.window.frameElement.getBoundingClientRect();
    const x = e.clientX + frame.left;
    // Highlight clicks are handled after this event; let them go first
    setTimeout(() => {
      if (selectionMenu.hidden) onTap(x, e.target);
    });
  });
  readerArea.addEventListener("click", (e) => onTap(e.clientX, e.target));

  /* ---------- Fullscreen ---------- */

  const isFullscreen = () => root.classList.contains("ep-fullscreen");
  const nativeFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;

  function setControls(show) {
    root.classList.toggle("ep-show-controls", show);
    // Hidden toolbars should not be reachable by keyboard
    toolbar.inert = footer.inert = isFullscreen() && !show;
  }

  function setFullscreen(on) {
    root.classList.toggle("ep-fullscreen", on);
    $("fullscreen-button").setAttribute("aria-pressed", String(on));
    setControls(false);
    try {
      if (on && !nativeFullscreenElement()) {
        // Not available everywhere (notably iPhone Safari), where this
        // stays an in-page immersive mode
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        if (request) Promise.resolve(request.call(root)).catch(() => {});
      } else if (!on && nativeFullscreenElement() === root) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        Promise.resolve(exit.call(document)).catch(() => {});
      }
    } catch (e) {}
  }

  $("fullscreen-button").onclick = () => setFullscreen(!isFullscreen());
  const onNativeFullscreenChange = () => {
    // Left native fullscreen via the browser (Esc, back gesture, …)
    if (nativeFullscreenElement() !== root && isFullscreen()) setFullscreen(false);
  };
  listen(document, "fullscreenchange", onNativeFullscreenChange);
  listen(document, "webkitfullscreenchange", onNativeFullscreenChange);

  /* ---------- Panels ---------- */

  function openPanel(panel) {
    closePanels();
    hideMenu();
    panel.inert = false;
    panel.classList.add("ep-open");
    scrim.hidden = false;
  }
  function closePanels() {
    for (const panel of [tocPanel, searchPanel]) {
      panel.classList.remove("ep-open");
      panel.inert = true;
    }
    scrim.hidden = true;
  }
  scrim.onclick = closePanels;
  for (const button of root.querySelectorAll(".ep-panel .ep-close")) {
    button.onclick = closePanels;
  }
  $("toc-button").onclick = () => {
    renderNotes();
    openPanel(tocPanel);
    $("toc").querySelector("a.ep-active")?.scrollIntoView({ block: "center" });
  };
  const tabs = tocPanel.querySelectorAll("[role=tab]");
  for (const tab of tabs) {
    tab.onclick = () => {
      if (tab === settingsTab) loadFontPreviews();
      for (const other of tabs) {
        const selected = other === tab;
        other.setAttribute("aria-selected", String(selected));
        root.querySelector("#" + CSS.escape(other.getAttribute("aria-controls"))).hidden = !selected;
      }
    };
  }
  $("search-button").onclick = () => {
    openPanel(searchPanel);
    $("search-input").focus();
  };

  /* ---------- Table of contents ---------- */

  /** Flat, document-ordered list of TOC entries with their spine index */
  const tocEntries = [];

  function spineIndex(href) {
    const section = book.spine.get(href);
    if (section) return section.index;
    const file = href.split("#")[0].split("/").pop();
    const match = book.spine.spineItems.find((item) => item.href.split("/").pop() === file);
    return match ? match.index : -1;
  }

  function buildToc(items) {
    const list = document.createElement("ol");
    for (const item of items) {
      const li = document.createElement("li"),
        a = document.createElement("a");
      a.textContent = item.label.trim();
      a.href = "#";
      a.onclick = (e) => {
        e.preventDefault();
        rendition.display(item.href);
        closePanels();
      };
      li.appendChild(a);
      tocEntries.push({ label: a.textContent, index: spineIndex(item.href), link: a });
      if (item.subitems && item.subitems.length) {
        li.appendChild(buildToc(item.subitems));
      }
      list.appendChild(li);
    }
    return list;
  }

  book.loaded.navigation.then((nav) => {
    $("toc").replaceChildren(buildToc(nav.toc));
    if (rendition.location) updateLocation(rendition.location);
  });

  /** The TOC entry covering the given spine index */
  function currentTocEntry(index) {
    let best = null;
    for (const entry of tocEntries) {
      if (entry.index < 0 || entry.index > index) continue;
      if (!best || entry.index > best.index) best = entry;
    }
    return best;
  }

  /* ---------- Location display ---------- */

  const cfiCompare = (a, b) => new ePub.CFI().compare(a, b);

  /**
   * Page number for a screen: the first location that starts on it, so
   * that displaying that location again lands on this same screen
   */
  function currentPage(loc) {
    const first = book.locations.locationFromCfi(loc.start.cfi),
      last = book.locations.locationFromCfi(loc.end.cfi);
    if (requestedPage !== null && requestedPage - 1 >= first && requestedPage - 1 <= last) {
      return requestedPage;
    }
    // Location `first` contains the screen's start; it only starts on the
    // screen if it begins exactly there (e.g. the start of the book)
    const firstStartsHere = cfiCompare(book.locations.cfiFromLocation(first), loc.start.cfi) >= 0;
    return (firstStartsHere || first >= last ? first : first + 1) + 1;
  }

  function updateLocation(loc) {
    const start = loc.start;
    const entry = currentTocEntry(start.index);
    chapter.textContent = entry ? entry.label : "";
    for (const e of tocEntries) e.link.classList.toggle("ep-active", e === entry);

    const parts = [];
    if (locationsReady) {
      const total = book.locations.length();
      const page = currentPage(loc);
      parts.push(`Page ${page} of ${total}`);
      // Replace rather than push, so page turns don't fill the history
      history.replaceState(history.state, "", "#loc=" + page);
      $("corner-info").textContent = `${page} / ${total}`;
      const pct = book.locations.percentageFromCfi(start.cfi);
      parts.push(`${Math.round(pct * 100)}%`);
      if (document.activeElement !== progress) {
        progress.value = Math.round(pct * 1000);
      }
    } else {
      parts.push("Counting pages…");
    }
    if (start.displayed && start.displayed.total > 1) {
      // In a spread, the right-hand page is already on screen too
      const shown = viewer.classList.contains("ep-spread") ? 1 : 0;
      const left = Math.max(0, start.displayed.total - start.displayed.page - shown);
      parts.push(left > 0 ? `${left} ${left === 1 ? "page" : "pages"} left in chapter` : "Last page in chapter");
    }
    pageInfo.textContent = parts.join(" · ");
  }

  rendition.on("rendered", () => root.classList.remove("ep-loading-book"));
  rendition.on("relocated", (loc) => {
    hideMenu();
    updateBookmarkButton(loc);
    updateLocation(loc);
    requestedPage = null;
    store.set(keys.position, loc.start.cfi);
  });

  book.ready
    .then(() => {
      const saved = store.get(keys.locations);
      if (saved) {
        book.locations.load(saved);
        return;
      }
      // Roughly one printed page per location
      return book.locations.generate(1500).then(() => {
        store.set(keys.locations, book.locations.save());
      });
    })
    .then(() => {
      if (destroyed) return;
      locationsReady = true;
      root.classList.remove("ep-counting-pages");
      renderNotes();
      progress.disabled = false;
      if (pendingPage !== null) {
        displayPage(pendingPage);
        pendingPage = null;
      } else if (rendition.location) {
        updateLocation(rendition.location);
      }
    });

  progress.onchange = () => {
    rendition.display(book.locations.cfiFromPercentage(progress.value / 1000));
  };

  /* ---------- Bookmarks & highlights ---------- */

  const savedAnnotations = store.getJSON(keys.annotations) || {};
  /** @type {Array<{cfi: string, chapter: string, created: number}>} */
  const bookmarks = savedAnnotations.bookmarks || [];
  /** @type {Array<{cfi: string, text: string, color: string, chapter: string, created: number}>} */
  const highlights = savedAnnotations.highlights || [];
  const saveAnnotations = () => store.setJSON(keys.annotations, { bookmarks, highlights });

  const byPosition = (a, b) => cfiCompare(a.cfi, b.cfi);
  /**
   * Page number of the screen a bookmark was made on. Saved with the
   * bookmark; for older ones, it's the first location starting at or after
   * the screen's start, as currentPage() works it out
   */
  function bookmarkPage(b) {
    if (b.page) return b.page;
    const loc = book.locations.locationFromCfi(b.cfi);
    return (cfiCompare(book.locations.cfiFromLocation(loc), b.cfi) >= 0 ? loc : loc + 1) + 1;
  }
  const currentChapter = () =>
    (rendition.location && currentTocEntry(rendition.location.start.index)?.label) || "";

  /* Bookmarks */

  const bookmarkButton = $("bookmark-button");

  /** Bookmarks that fall on the screen currently shown */
  function bookmarksOnScreen(loc) {
    if (!loc) return [];
    return bookmarks.filter((b) => cfiCompare(b.cfi, loc.start.cfi) >= 0 && cfiCompare(b.cfi, loc.end.cfi) <= 0);
  }

  function updateBookmarkButton(loc = rendition.location) {
    const marked = bookmarksOnScreen(loc).length > 0;
    bookmarkButton.setAttribute("aria-pressed", String(marked));
    bookmarkButton.title = marked ? "Remove bookmark (B)" : "Bookmark this page (B)";
  }

  function toggleBookmark() {
    const loc = rendition.location;
    if (!loc) return;
    const here = bookmarksOnScreen(loc);
    if (here.length) {
      for (const b of here) bookmarks.splice(bookmarks.indexOf(b), 1);
    } else {
      bookmarks.push({
        cfi: loc.start.cfi,
        page: locationsReady ? currentPage(loc) : undefined,
        chapter: currentChapter(),
        created: Date.now(),
      });
    }
    saveAnnotations();
    updateBookmarkButton(loc);
    renderNotes();
  }
  bookmarkButton.onclick = toggleBookmark;

  /* Highlights */

  function showHighlight(h) {
    rendition.annotations.highlight(
      h.cfi,
      {},
      (e) => {
        // Marks also report touchstart; only a real tap opens the menu
        if (e.type !== "click") return;
        const range = rendition.getRange(h.cfi);
        if (range) showMenu(range, { highlight: h });
      },
      "ep-user-highlight",
      { fill: HIGHLIGHT_COLORS[h.color], "fill-opacity": "0.45", "mix-blend-mode": "multiply" },
    );
  }
  highlights.forEach(showHighlight);

  function removeHighlight(h) {
    rendition.annotations.remove(h.cfi, "highlight");
    highlights.splice(highlights.indexOf(h), 1);
    saveAnnotations();
    renderNotes();
  }

  /** Show the menu just below a range in the book */
  function showMenu(range, target) {
    menuTarget = target;
    $("remove-highlight").hidden = !target.highlight;
    for (const swatch of selectionMenu.querySelectorAll(".ep-swatch")) {
      swatch.setAttribute("aria-pressed", String(target.highlight?.color === swatch.dataset.color));
    }
    selectionMenu.hidden = false;

    // Range coordinates are relative to the (very wide, scrolled) iframe;
    // the menu is positioned within the reader
    const bounds = root.getBoundingClientRect();
    const frame = range.startContainer.ownerDocument.defaultView.frameElement.getBoundingClientRect();
    const rect = range.getBoundingClientRect();
    const menu = selectionMenu.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, frame.left - bounds.left + rect.left + rect.width / 2 - menu.width / 2),
      bounds.width - menu.width - 8,
    );
    // Below the text (clear of the phone's own selection menu), else above
    let top = frame.top - bounds.top + rect.bottom + 10;
    if (top + menu.height > bounds.height - 8) {
      top = frame.top - bounds.top + rect.top - menu.height - 10;
    }
    selectionMenu.style.left = left + "px";
    selectionMenu.style.top = Math.max(8, top) + "px";
  }

  function hideMenu() {
    selectionMenu.hidden = true;
    menuTarget = null;
  }

  rendition.on("selected", (cfiRange, contents) => {
    const range = contents.range(cfiRange);
    if (range && !range.collapsed) showMenu(range, { cfi: cfiRange, text: range.toString(), contents });
  });
  // A press anywhere else dismisses the menu
  const onPress = (e) => {
    menuWasOpen = !selectionMenu.hidden;
    if (!selectionMenu.contains(e.target)) hideMenu();
  };
  rendition.on("mousedown", onPress);
  rendition.on("touchstart", onPress);
  listen(document, "mousedown", onPress);
  listen(document, "touchstart", onPress, { passive: true });

  for (const swatch of selectionMenu.querySelectorAll(".ep-swatch")) {
    swatch.style.background = HIGHLIGHT_COLORS[swatch.dataset.color];
    swatch.onclick = () => {
      const color = swatch.dataset.color;
      if (menuTarget.highlight) {
        const h = menuTarget.highlight;
        rendition.annotations.remove(h.cfi, "highlight");
        h.color = color;
        showHighlight(h);
      } else {
        if (menuTarget.shared) {
          rendition.annotations.remove(sharedPassage, "highlight");
          sharedPassage = null;
        }
        const h = {
          cfi: menuTarget.cfi,
          text: menuTarget.text.trim().replace(/\s+/g, " "),
          color,
          chapter: currentChapter(),
          created: Date.now(),
        };
        highlights.push(h);
        showHighlight(h);
        menuTarget.contents?.window.getSelection().removeAllRanges();
      }
      saveAnnotations();
      renderNotes();
      hideMenu();
    };
  }
  $("share-highlight").onclick = () => {
    const cfi = menuTarget.highlight ? menuTarget.highlight.cfi : menuTarget.cfi;
    const text = menuTarget.highlight ? menuTarget.highlight.text : menuTarget.text;
    sharePassage(cfi, text);
    hideMenu();
  };
  $("remove-highlight").onclick = () => {
    if (menuTarget.highlight) removeHighlight(menuTarget.highlight);
    hideMenu();
  };

  /* Lists in the contents panel */

  function toolButton(label, icon, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ep-tool";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = icon;
    button.onclick = onClick;
    return button;
  }

  function noteItem({ where, text, color, cfi, bookmark, onShare, onDelete }) {
    const li = document.createElement("li"),
      a = document.createElement("a"),
      meta = document.createElement("span");
    a.href = "#";
    meta.className = "ep-where";
    if (bookmark) {
      li.className = "ep-bookmark-note";
      meta.innerHTML = $("bookmark-button").innerHTML;
      meta.firstElementChild.setAttribute("aria-label", "Bookmark");
      meta.firstElementChild.removeAttribute("aria-hidden");
    }
    meta.append(where);
    a.appendChild(meta);
    if (text) {
      const quote = document.createElement("span");
      quote.className = "ep-note-text";
      quote.textContent = text;
      a.appendChild(quote);
    }
    if (color) li.style.borderLeftColor = HIGHLIGHT_COLORS[color];
    a.onclick = (e) => {
      e.preventDefault();
      rendition.display(cfi);
      closePanels();
    };
    li.append(
      a,
      toolButton("Share link", $("share-highlight").innerHTML, onShare),
      toolButton("Delete", $("remove-highlight").innerHTML, onDelete),
    );
    return li;
  }

  function emptyNote(text) {
    const li = document.createElement("li");
    li.className = "ep-empty";
    li.textContent = text;
    return li;
  }

  /** Bookmarks and highlights together, in book order */
  function renderNotes() {
    const where = (note, page) => [note.chapter, locationsReady && `Page ${page()}`].filter(Boolean).join(" · ");
    const items = [
      ...bookmarks.map((b) => ({
        cfi: b.cfi,
        where: where(b, () => bookmarkPage(b)) || "Bookmark",
        bookmark: true,
        onShare: () => sharePage(bookmarkPage(b), b.chapter),
        onDelete: () => {
          bookmarks.splice(bookmarks.indexOf(b), 1);
          saveAnnotations();
          updateBookmarkButton();
          renderNotes();
        },
      })),
      ...highlights.map((h) => ({
        cfi: h.cfi,
        where: where(h, () => pageOf(h.cfi)),
        text: h.text,
        color: h.color,
        onShare: () => sharePassage(h.cfi, h.text),
        onDelete: () => removeHighlight(h),
      })),
    ];
    const list = $("note-list");
    list.replaceChildren(...items.sort(byPosition).map(noteItem));
    if (!items.length) {
      list.append(
        emptyNote("No bookmarks or highlights yet. Bookmark a page with the bookmark button or B, or select some text to highlight it."),
      );
    }
  }

  /* ---------- Sharing ---------- */

  const toastEl = $("toast");
  let toastTimer = null;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("ep-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("ep-show"), 2500);
  }
  cleanups.push(() => clearTimeout(toastTimer));

  const share = ({ url, text }) => shareLink({ title: bookName || document.title, text, url }, toast);
  const pageOf = (cfi) => book.locations.locationFromCfi(cfi) + 1;
  const notReady = () => toast("Still counting pages, try again in a moment");

  function sharePage(page, chapter) {
    if (!locationsReady) return notReady();
    share({ url: pageLink(page), text: chapter });
  }

  function sharePassage(cfi, text) {
    if (!locationsReady) return notReady();
    const quote = text.trim().replace(/\s+/g, " ");
    share({ url: passageLink(cfi, pageOf(cfi)), text: `“${quote}”` });
  }

  $("share-button").onclick = () => {
    if (!rendition.location) return notReady();
    sharePage(currentPage(rendition.location), currentChapter());
  };

  /* ---------- Search ---------- */

  let searchToken = 0,
    searchHighlight = null;

  function clearSearchHighlight() {
    if (searchHighlight) {
      rendition.annotations.remove(searchHighlight, "highlight");
      searchHighlight = null;
    }
  }

  async function runSearch(query) {
    const token = ++searchToken;
    const status = $("search-status"),
      results = $("search-results");
    results.replaceChildren();
    clearSearchHighlight();
    if (!query) {
      status.textContent = "";
      return;
    }
    await book.ready;
    let count = 0;
    const sections = book.spine.spineItems;
    for (const [i, section] of sections.entries()) {
      if (token !== searchToken) return;
      status.textContent = `Searching… ${Math.round((i / sections.length) * 100)}%`;
      await section.load(book.load.bind(book));
      const matches = section.find(query);
      section.unload();
      if (token !== searchToken) return;

      const entry = currentTocEntry(section.index);
      for (const match of matches) {
        count++;
        const li = document.createElement("li"),
          a = document.createElement("a"),
          where = document.createElement("span");
        a.href = "#";
        where.className = "ep-where";
        where.textContent = entry ? entry.label : "";
        a.appendChild(where);
        a.appendChild(excerpt(match.excerpt, query));
        a.onclick = (e) => {
          e.preventDefault();
          for (const other of results.querySelectorAll("a.ep-active")) other.classList.remove("ep-active");
          a.classList.add("ep-active");
          clearSearchHighlight();
          rendition.display(match.cfi).then(() => {
            rendition.annotations.highlight(match.cfi);
            searchHighlight = match.cfi;
          });
          // On narrow readers the panel covers the page
          if (root.clientWidth < 700) closePanels();
        };
        li.appendChild(a);
        results.appendChild(li);
      }
    }
    status.textContent = count ? `${count} ${count === 1 ? "result" : "results"}` : "No results";
  }

  /** Excerpt text with the matched query emphasized */
  function excerpt(text, query) {
    const span = document.createElement("span"),
      lower = text.toLowerCase(),
      q = query.toLowerCase();
    let pos = 0,
      found;
    while ((found = lower.indexOf(q, pos)) !== -1) {
      span.append(text.slice(pos, found));
      const mark = document.createElement("mark");
      mark.textContent = text.slice(found, found + q.length);
      span.append(mark);
      pos = found + q.length;
    }
    span.append(text.slice(pos));
    return span;
  }

  $("search-form").onsubmit = (e) => {
    e.preventDefault();
    runSearch($("search-input").value.trim());
  };

  /* ---------- Teardown ---------- */

  let destroyed = false;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    searchToken++; // stops a search in progress
    if (nativeFullscreenElement() === root) setFullscreen(false);
    for (const cleanup of cleanups) cleanup();
    rendition.destroy();
    book.destroy();
  }

  return { book, rendition, destroy };
}
