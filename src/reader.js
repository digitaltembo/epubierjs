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
/** Text alignments, in the order the settings tab lists them (labeled by strings.json's `alignments`) */
const ALIGNMENTS = {
  justify: { value: "justify" },
  left: { value: "left" },
  right: { value: "right" },
  original: { value: null },
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
/** Layout choice, pages or a scroll, shared by every book */
const ZOOM_KEY = "epubier-zoom";
/** Zoom levels for fixed pages, in percent of fitting the screen */
const ZOOMS = [50, 75, 100, 125, 150, 200, 250, 300, 400];
const FLOW_KEY = "epubier-flow";
/** Where there's likely no keyboard, so the notes don't mention its shortcut */
const TOUCH_MEDIA = "(pointer: coarse)";
/** Where the reader is immersive by default: touch screens upright, and phones on their side */
const IMMERSIVE_MEDIA = "(pointer: coarse) and (orientation: portrait), (pointer: coarse) and (max-height: 500px)";
/** How long the toolbars show for when an immersive reader opens, in ms */
const HINT_DURATION = 3000;
/** How near the top or bottom of an immersive reader the mouse shows the toolbars, in px */
const HOVER_EDGE = 40;
/** Layouts, in the order the settings tab lists them (labeled by strings.json's `layouts`) */
const FLOWS = {
  paginated: { icon: '<path d="M3 5h8v14H3zM13 5h8v14h-8z" />' },
  scrolled: { icon: '<path d="M6 3h12v18H6zM12 7v9M9 13l3 3 3-3" />' },
};

/** Page turn choice, sliding or not, shared by every book */
const TURN_KEY = "epubier-page-turn";
/** Ways of turning pages, in the order the settings tab lists them (labeled by strings.json's `pageTurns`) */
const TURNS = {
  slide: { icon: '<path d="M10 5h11v14H10M3 5h7v14H3zM6 12h-4M4 10l-2 2 2 2" />' },
  none: { icon: '<path d="M6 3h12v18H6z" />' },
};

/** A layout's or page turn's icon, from its paths */
function optionIcon(paths) {
  const span = document.createElement("span");
  span.className = "ep-option-icon";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24">${paths}</svg>`;
  return span;
}
const SHARED_PASSAGE_STYLE = { fill: "#fb923c", "fill-opacity": "0.35", "mix-blend-mode": "multiply" };

/** A book's file name, without its extension, for books that don't give a title */
function fileTitle(url) {
  if (typeof url !== "string") return "";
  try {
    const name = new URL(url, location.href).pathname.split("/").pop();
    return decodeURIComponent(name).replace(/\.[^.]+$/, "");
  } catch (e) {
    return "";
  }
}

/**
 * Runs the reader inside `root`, which already contains the template.
 *
 * The book is shown by a session, which a format opens (see EpubierFormat and
 * EpubierSession in epubier.d.ts); this is everything around it.
 *
 * @param {HTMLElement} root
 * @param {string | ArrayBuffer | Blob} url of the book, or its contents
 * @param {object} opts epubier()'s options
 * @param {(key: string, vars?: object) => string} t The reader's text (see strings.js)
 * @param {(url: string | ArrayBuffer | Blob) => {format: object, input: string | ArrayBuffer | Blob} | Promise<{format: object, input: string | ArrayBuffer | Blob}>} chooseFormat
 *   The format to open the book with, and what to give it: `url`, or the
 *   book's contents if they had to be fetched to tell
 * @returns {{session: object | null, ready: Promise<object | null>, destroy: () => void}}
 */
export function createReader(root, url, opts, t, chooseFormat) {
  const $ = (name) => root.querySelector(".ep-" + name);
  /** Listeners on window/document, and the like, removed by destroy() */
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

  // Any of the toolbar's buttons can be left out; back also needs onBackPressed
  const buttons = { back: true, contents: true, bookmark: true, fullscreen: true, share: true, search: true, ...opts.toolbar };
  const back = $("back");
  if (opts.onBackPressed && buttons.back) {
    back.hidden = false;
    back.onclick = () => opts.onBackPressed();
  }
  $("toc-button").hidden = !buttons.contents;
  $("bookmark-button").hidden = !buttons.bookmark;
  $("fullscreen-button").hidden = !buttons.fullscreen;
  // share: false leaves out every way of sharing a link: the toolbar's, a selection's and the notes'
  const sharing = opts.share !== false;
  $("share-button").hidden = !buttons.share || !sharing;
  $("share-highlight").hidden = !sharing;
  // The toolbar is the window's title bar: it moves the window
  root.classList.toggle("ep-title-bar", !!opts.titleBar);

  function showError(title, message) {
    root.classList.remove("ep-loading-book", "ep-counting-pages");
    bookTitle.textContent = title;
    const text = document.createElement("p");
    text.className = "ep-message";
    text.textContent = message;
    viewer.replaceChildren(text);
  }

  if (!url) {
    showError(t("errors.noBookTitle"), t("errors.noBook"));
    return { session: null, ready: Promise.resolve(null), destroy() {} };
  }
  if (typeof url !== "string" && !opts.storageKey) {
    throw new TypeError("epubier: a storageKey option is required when opening a book from its contents");
  }

  let destroyed = false;
  // Fullscreen asked for before the book is open waits for it
  let pendingFullscreen;
  const reader = {
    session: null,
    ready: null,
    destroy,
    setFullscreen(on) {
      pendingFullscreen = !!on;
    },
  };

  /** Opens the book with the format chosen for it */
  function open({ format, input }) {
    const ctx = {
      opts,
      store,
      keys: storageKeys(opts.storageKey ?? url, format.storageId ?? format.id),
      t,
      // Pages or a scroll, chosen before the session's made so it starts that way
      flow: [store.get(FLOW_KEY), opts.flow].find((id) => id && FLOWS[id]) || "paginated",
    };
    const start = (openSession) => {
      if (destroyed) return null;
      const session = openSession(viewer, input, ctx);
      return session.then ? session.then((s) => run(format, s, ctx)) : run(format, session, ctx);
    };
    // Formats with big dependencies load them only once they're needed
    return format.open ? start(format.open) : format.load().then((engine) => start(engine.open));
  }

  let opening;
  try {
    const choice = chooseFormat(url);
    opening = choice.then ? choice.then(open) : open(choice);
  } catch (e) {
    opening = Promise.reject(e);
  }
  reader.ready = Promise.resolve(opening).catch((error) => {
    if (destroyed) return null;
    console.error(error);
    showError(t("errors.openFailed"), t.error(error));
    return null;
  });

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const cleanup of cleanups) cleanup();
  }

  /** Runs the reader around an open session */
  function run(format, session, { keys, flow }) {
    if (destroyed) {
      session.destroy();
      return null;
    }
    reader.session = session;
    const capabilities = session.capabilities;
    root.classList.toggle("ep-reflowable", capabilities.reflow);

    /* ---------- Settings: theme, font and alignment ---------- */

    // A theme sets the reader's custom properties on top of `styles`, and
    // colors the book's own text to match. A font replaces the book's own,
    // and an alignment applies to the book's ordinary paragraphs; those are
    // only for books whose text reflows.
    const themes = resolveThemes(opts.themes, t),
      fonts = capabilities.reflow ? resolveFonts(opts.fonts, t) : {};
    const baseProperties = new Map(styleProperties(opts.styles));
    const rootStyle = getComputedStyle(root);
    // Colors without any theme, for the White theme's swatch
    const baseColors = {
      page: rootStyle.getPropertyValue("--ep-page").trim(),
      text: rootStyle.getPropertyValue("--ep-ink").trim(),
    };
    let theme = null,
      dark = false,
      font = null,
      align = null,
      textSize = 100;

    function isDarkColor(color) {
      const [r, g, b] = (color.match(/[\d.]+/g) || [255, 255, 255]).map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
    }

    /** Has the book take on the current settings */
    function updateLook() {
      return session.setLook?.({
        text: rootStyle.color,
        accent: rootStyle.getPropertyValue("--ep-accent").trim(),
        dark,
        font,
        align: ALIGNMENTS[align]?.value ?? null,
        textSize,
      });
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

    function applyTheme(id) {
      for (const [property] of theme?.properties || []) {
        if (baseProperties.has(property)) root.style.setProperty(property, baseProperties.get(property));
        else root.style.removeProperty(property);
      }
      theme = themes[id];
      for (const [property, value] of theme.properties) root.style.setProperty(property, value);

      dark = theme.dark ?? isDarkColor(getComputedStyle(viewer).backgroundColor);
      root.classList.toggle("ep-dark", dark);
      updateLook();
      checkOption("themes", id);
      const background = rootStyle.backgroundColor;
      opts.onThemeChange?.({ id, background, dark: isDarkColor(background) });
    }

    function applyFont(id) {
      font = fonts[id];
      checkOption("fonts", id);
      preloadFont(font);
      updateLook();
    }

    function applyTextSize(size) {
      textSize = size;
      const i = TEXT_SIZES.indexOf(size);
      $("text-size-value").textContent = t("percent", { percent: size });
      $("text-smaller").disabled = i <= 0;
      $("text-larger").disabled = i >= TEXT_SIZES.length - 1;
      updateLook();
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

    // Fixed pages (PDFs, comics) zoom instead of changing the text size
    let zoom = 100;
    function applyZoom(value) {
      zoom = value;
      const i = ZOOMS.indexOf(value);
      $("zoom-value").textContent = t("percent", { percent: value });
      $("zoom-out").disabled = i <= 0;
      $("zoom-in").disabled = i >= ZOOMS.length - 1;
      session.setZoom(value / 100);
    }
    function stepZoom(step) {
      const i = ZOOMS.indexOf(zoom) + step;
      if (i < 0 || i >= ZOOMS.length) return;
      applyZoom(ZOOMS[i]);
      store.set(ZOOM_KEY, String(ZOOMS[i]));
    }
    $("zoom-out").onclick = () => stepZoom(-1);
    $("zoom-in").onclick = () => stepZoom(1);
    $("zoom-value").onclick = () => {
      applyZoom(100);
      store.set(ZOOM_KEY, "100");
    };

    function applyAlign(id) {
      align = id;
      checkOption("aligns", id);
      updateLook();
    }

    // Pages or a scroll, for formats that can do both. A scroll of text is
    // narrower; the session lays itself out anew, so that's no resize.
    function applyFlow(id) {
      checkOption("flows", id);
      root.classList.toggle("ep-scrolled", id === "scrolled");
      lastSize = viewerSize();
      session.setFlow(id);
    }

    // Whether turning a page slides it (see turn)
    let pageTurn;
    function applyTurn(id) {
      checkOption("turns", id);
      pageTurn = id;
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

    for (const [id, th] of Object.entries(themes)) {
      const option = addOption("themes", id, th.label, THEME_KEY, applyTheme);
      const swatch = document.createElement("span");
      swatch.className = "ep-theme-swatch";
      swatch.setAttribute("aria-hidden", "true");
      swatch.textContent = t("settings.themeSample");
      const values = Object.fromEntries(th.properties);
      swatch.style.background = values["--ep-page"] || baseColors.page;
      swatch.style.color = values["--ep-ink"] || baseColors.text;
      option.querySelector("input").after(swatch);
    }
    for (const [id, f] of Object.entries(fonts)) {
      const option = addOption("fonts", id, f.label, FONT_KEY, applyFont);
      if (f.family) option.querySelector(".ep-option-name").style.fontFamily = f.family;
    }

    if (session.setFlow) {
      for (const [id, f] of Object.entries(FLOWS)) {
        const option = addOption("flows", id, t(`layouts.${id}`), FLOW_KEY, applyFlow);
        option.querySelector("input").after(optionIcon(f.icon));
      }
      // The session started this way
      checkOption("flows", flow);
      root.classList.toggle("ep-scrolled", flow === "scrolled");
    }

    for (const [id, turnOption] of Object.entries(TURNS)) {
      const option = addOption("turns", id, t(`pageTurns.${id}`), TURN_KEY, applyTurn);
      option.querySelector("input").after(optionIcon(turnOption.icon));
    }

    if (capabilities.reflow) {
      for (const [id, a] of Object.entries(ALIGNMENTS)) {
        const option = addOption("aligns", id, t(`alignments.${id}`), ALIGN_KEY, applyAlign);
        option.querySelector("input").after(alignIcon(a.value));
      }
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
    $("flow-settings").hidden = !session.setFlow;
    $("font-settings").hidden = Object.keys(fonts).length < 2;
    $("size-settings").hidden = $("align-settings").hidden = !capabilities.reflow;
    $("zoom-settings").hidden = !session.setZoom;
    const settingsTab = tocPanel.querySelector(`[aria-controls="${$("settings").id}"]`);
    settingsTab.hidden = [...$("settings").children].every((section) => section.hidden);

    if (Object.keys(themes).length) applyTheme(choose(themes, THEME_KEY, { opt: opts.theme, default: DEFAULT_THEME }));
    applyTurn(choose(TURNS, TURN_KEY, { opt: opts.pageTurn, default: "slide" }));
    if (Object.keys(fonts).length) applyFont(choose(fonts, FONT_KEY, { opt: opts.font, default: DEFAULT_FONT }));
    if (capabilities.reflow) {
      applyAlign(choose(ALIGNMENTS, ALIGN_KEY, { opt: opts.align, default: "justify" }));
      applyTextSize(
        [Number(store.get(SIZE_KEY)), Number(opts.textSize), 100].find((size) => TEXT_SIZES.includes(size)),
      );
    }
    if (session.setZoom) {
      applyZoom([Number(store.get(ZOOM_KEY)), Number(opts.zoom), 100].find((value) => ZOOMS.includes(value)));
    }

    /* ---------- State ---------- */

    /** Whether page numbers are available yet */
    let pagesReady = false,
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
    // link can point at a specific place in the book. Page numbers may take
    // a while to work out (an ePub's are counted), so a #loc link waits for
    // them. A shared passage adds its exact location, in the format's own
    // terms (for an ePub, a CFI without the "epubcfi(…)" wrapper):
    // #loc=21&hl=/6/6[ch01]!/4/2/150,/5:10,/5:42
    function parseHash() {
      const match = /^#loc=(\d+)(?:&hl=(.+))?$/.exec(location.hash);
      if (!match) return { page: null, passage: null };
      let passage = null;
      try {
        if (match[2] && capabilities.highlights) passage = session.fromLink(decodeURIComponent(match[2]));
      } catch (e) {}
      return { page: parseInt(match[1], 10), passage };
    }
    const baseUrl = () => location.origin + location.pathname + location.search;
    const pageLink = (page) => `${baseUrl()}#loc=${page}`;
    const passageLink = (where, page) => `${pageLink(page)}&hl=${session.toLink(where).replace(/[%#& ]/g, encodeURIComponent)}`;

    function goToPage(page) {
      if (pagesReady) session.displayPage(page);
      else pendingPage = page;
    }

    // A shared passage needs no page numbers, so show it straight away
    function showSharedPassage(where, page) {
      session.display(where).then(
        () => {
          if (sharedPassage) session.unhighlight(sharedPassage);
          sharedPassage = where;
          session.highlight(where, {
            className: "ep-shared-passage",
            style: SHARED_PASSAGE_STYLE,
            onClick: ({ rect, text }) => showMenu(rect, { cfi: where, text, shared: true }),
          });
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
      if (root.isConnected && !destroyed && !followHash()) {
        session.display(opts.position || store.get(keys.position) || undefined);
      }
    });
    // Hash edited by hand or a link followed within the page
    listen(window, "hashchange", followHash);

    session.opened?.catch((error) => {
      console.error(error);
      showError(t("errors.openFailed"), t.error(error));
    });

    session.metadata.then((meta) => {
      bookName = meta.title || fileTitle(url);
      bookTitle.textContent = meta.creator ? t("titleWithAuthor", { title: bookName, author: meta.creator }) : bookName;
    });

    // Two-page spreads get a faint gutter line
    session.on("layout", ({ spread }) => {
      viewer.classList.toggle("ep-spread", spread);
    });

    // epub.js only re-lays out on window resizes; the reader can also change
    // size on its own (host layout, fullscreen)
    let lastSize = "",
      resizeTimer = null;
    const viewerSize = () => `${viewer.clientWidth}x${viewer.clientHeight}`;
    const resizeObserver = new ResizeObserver(() => {
      const size = viewerSize();
      if (size === lastSize) return;
      const first = !lastSize;
      lastSize = size;
      if (first) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => session.resize(), 100);
    });
    resizeObserver.observe(viewer);
    cleanups.push(() => {
      resizeObserver.disconnect();
      clearTimeout(resizeTimer);
    });

    /* ---------- Navigation ---------- */

    // Turning a page lifts it off to the left, uncovering the next, and
    // turning back lays the one before over it from the left. It's a view
    // transition (styled in styles.js): the page is captured as it was, then
    // turned, and the transition waits for the turn (a session's next and
    // prev may return a promise), as Safari shows the page underneath as it
    // is once the transition has started. Rendering waits too, so not for
    // long: a turn that takes longer (a chapter loading) has no slide.
    //
    // WebKit (Safari, and the system's web view on Apple's systems and Linux)
    // draws a page with a book's frame in it, as it is now, where it is,
    // however a view transition moves it, so there a turn back is no view
    // transition: the page is covered with a copy of itself, turned back
    // underneath, and slid in over the copy. There's no telling but by name.
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const TURN_WAIT = 300;
    const TURN = { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" };
    // Transition types, which keep those styles to this transition, came after view transitions
    const canSlide = typeof ViewTransition !== "undefined" && "types" in ViewTransition.prototype;
    const webKit = /AppleWebKit/.test(navigator.userAgent) && !/Chrome\/|Chromium|Edg\/|Android/.test(navigator.userAgent);
    let turnTransition = null;
    // A turn back over a copy, which a turn finishes before it starts
    let layingOver = null;
    function turn(step) {
      turnTransition?.skipTransition();
      layingOver?.finish();
      const go = () => (step > 0 ? session.next() : session.prev());
      const here = session.location();
      const nowhere = step > 0 ? here?.atEnd : here?.atStart;
      if (pageTurn !== "slide" || !canSlide || nowhere || root.classList.contains("ep-scrolled") || reducedMotion.matches) {
        return go();
      }
      const frame = viewer.querySelector("iframe");
      if (step < 0 && webKit && frame) {
        layingOver = layOver(frame, go);
        return;
      }
      viewer.style.viewTransitionName = "ep-turning-page";
      let late = false;
      const transition = document.startViewTransition({
        types: [
          "ep-turn",
          step > 0 ? "ep-turn-next" : "ep-turn-prev",
          // A dark page is shaded more, for the shade to show as much
          ...(root.classList.contains("ep-dark") ? ["ep-turn-dark"] : []),
        ],
        update: () =>
          Promise.race([
            Promise.resolve(go()).catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, TURN_WAIT)).then(() => (late = true)),
          ]),
      });
      turnTransition = transition;
      // Skipped, as by the next turn, it rejects; that's no error
      transition.ready.then(() => late && transition.skipTransition()).catch(() => {});
      transition.finished.then(() => {
        if (turnTransition !== transition) return;
        turnTransition = null;
        viewer.style.viewTransitionName = "";
      });
    }
    cleanups.push(() => turnTransition?.skipTransition());
    cleanups.push(() => layingOver?.finish());

    /** Turns back over a copy of the page; finish() turns back, if it hasn't yet, and ends it at once */
    function layOver(frame, turnBack) {
      const container = frame.closest(".epub-container");
      let done = false,
        turned = null,
        animations = [];
      const back = () => (turned ??= Promise.resolve(turnBack()).catch(() => {}));
      const cover = container.cloneNode(true);
      const copy = cover.querySelector("iframe");
      cover.classList.add("ep-turn-cover");
      cover.setAttribute("aria-hidden", "true");
      Object.assign(cover.style, {
        position: "absolute",
        left: `${container.offsetLeft}px`,
        top: `${container.offsetTop}px`,
        // Until it's drawn
        visibility: "hidden",
      });
      copy.tabIndex = -1;
      copy.removeAttribute("src");
      copy.srcdoc = `<!doctype html>${frame.contentDocument.documentElement.outerHTML}`;
      const end = () => {
        if (done) return;
        done = true;
        for (const animation of animations) animation.cancel();
        cover.remove();
        container.classList.remove("ep-laid-over");
        if (layingOver === turning) layingOver = null;
      };
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const frameDrawn = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const run = async () => {
        viewer.append(cover);
        // The copy shown as the page is, before the page is turned under it
        const shown = new Promise((resolve) => copy.addEventListener("load", resolve, { once: true }))
          .then(() => {
            cover.scrollLeft = container.scrollLeft;
            cover.scrollTop = container.scrollTop;
            return copy.contentDocument?.fonts?.ready;
          })
          .then(frameDrawn)
          .then(() => {
            cover.style.visibility = "";
            return frameDrawn();
          });
        if ((await Promise.race([shown.then(() => true), wait(TURN_WAIT).then(() => false)])) === false || done) {
          end();
          return back();
        }
        const inTime = await Promise.race([back().then(() => true), wait(TURN_WAIT).then(() => false)]);
        if (!inTime || done) return end();
        container.classList.add("ep-laid-over");
        animations = [
          container.animate(
            [
              { transform: "translateX(-100%)", boxShadow: "6px 0 18px rgb(0 0 0 / 0.25)" },
              { transform: "none", boxShadow: "0 0 0 rgb(0 0 0 / 0)" },
            ],
            TURN,
          ),
          cover.animate(
            [{ filter: "brightness(1)" }, { filter: `brightness(${root.classList.contains("ep-dark") ? 0.7 : 0.85})` }],
            TURN,
          ),
        ];
        await animations[0].finished.catch(() => {});
        end();
      };
      const turning = {
        finish() {
          back();
          end();
        },
      };
      run().catch(end);
      return turning;
    }

    const next = () => turn(1),
      prev = () => turn(-1);
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
      else if ((e.key === "f" || e.key === "F") && buttons.fullscreen) setFullscreen(!isFullscreen());
      else if ((e.key === "b" || e.key === "B") && buttons.bookmark) toggleBookmark();
      else if (e.key === "Escape") {
        if (!selectionMenu.hidden) hideMenu();
        else if (tocPanel.classList.contains("ep-open") || searchPanel.classList.contains("ep-open")) closePanels();
        else if (isFullscreen()) setFullscreen(false);
      }
    }
    listen(document, "keydown", onKey);
    session.on("keydown", onKey);

    /* ---------- Swipe & tap ---------- */

    // Touches inside the book's own document (an ePub's iframe) come through
    // the session, the rest (including the margins around the page) from the
    // reader area. screenX/Y is comparable across both.
    let touchStart = null,
      lastSwipe = 0;
    /**
     * Whether `el` is in something scrolled sideways, like a zoomed-in page.
     * Not in an ePub's own document, whose chapter is laid out as one wide
     * row of columns, scrolled a page at a time.
     */
    function pans(el) {
      if (!readerArea.contains(el)) return false;
      for (; el && el !== readerArea; el = el.parentElement) {
        if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
      }
      return false;
    }
    /** Whether there's text selected where `e` happened, as while choosing what to highlight */
    function selecting(e) {
      const selection = e.target?.ownerDocument?.defaultView?.getSelection();
      return !!selection && !selection.isCollapsed;
    }
    const onTouchStart = (e) => {
      if (e.touches.length > 1 || pans(e.target) || selecting(e)) {
        // Pinch zoom, moving around a zoomed page, or moving the ends of a
        // selection: not a swipe
        touchStart = null;
        return;
      }
      const touch = e.changedTouches[0];
      touchStart = { x: touch.screenX, y: touch.screenY, time: Date.now() };
    };
    const onTouchEnd = (e) => {
      if (!touchStart) return;
      const touch = e.changedTouches[0];
      const dx = touch.screenX - touchStart.x,
        dy = touch.screenY - touchStart.y,
        elapsed = Date.now() - touchStart.time;
      touchStart = null;
      // A drag that selected text is not a swipe either
      if (selecting(e)) return;
      if (elapsed < 800 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        lastSwipe = Date.now();
        dx < 0 ? next() : prev();
      }
    };
    session.on("touchstart", onTouchStart);
    session.on("touchend", onTouchEnd);
    const readerArea = $("reader");
    readerArea.addEventListener("touchstart", onTouchStart, { passive: true });
    readerArea.addEventListener("touchend", onTouchEnd);

    // Immersive, tap the outer thirds to turn pages and the middle to show
    // or hide the controls. Where the arrows are hidden otherwise, the outer
    // thirds turn pages too. `x` is relative to the window.
    const arrowsHidden = () => getComputedStyle($("prev")).display === "none";
    function onTap(x, target) {
      const immersive = isImmersive();
      if ((!immersive && !arrowsHidden()) || Date.now() - lastSwipe < 500) return;
      if (target.closest && target.closest("a")) return;
      const bounds = root.getBoundingClientRect();
      const position = (x - bounds.left) / bounds.width;
      if (position < 0.3) {
        setControls(false);
        prev();
      } else if (position > 0.7) {
        setControls(false);
        next();
      } else if (immersive) {
        setControls(!root.classList.contains("ep-show-controls"));
      }
    }
    session.on("click", ({ x, target }) => {
      if (menuWasOpen) return; // this tap just dismissed the highlight menu
      // Highlight clicks are handled after this event; let them go first
      setTimeout(() => {
        if (selectionMenu.hidden) onTap(x, target);
      });
    });
    readerArea.addEventListener("click", (e) => onTap(e.clientX, e.target));

    /* ---------- Fullscreen ---------- */

    const isFullscreen = () => root.classList.contains("ep-fullscreen");
    const nativeFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;

    let hintTimer = 0,
      hinted = false,
      /** Whether the toolbars are showing because the mouse is at the top or bottom */
      hoverShown = false,
      hoverTimer = 0;
    function cancelHoverHide() {
      clearTimeout(hoverTimer);
      hoverTimer = 0;
    }
    function setControls(show, byHover = false) {
      clearTimeout(hintTimer);
      cancelHoverHide();
      hoverShown = show && byHover;
      root.classList.toggle("ep-show-controls", show);
      // Hidden toolbars should not be reachable by keyboard
      toolbar.inert = footer.inert = isImmersive() && !show;
    }
    // Shown for a moment when the book first shows, to show they're there
    function hintControls() {
      if (hinted || !isImmersive()) return;
      hinted = true;
      setControls(true);
      hintTimer = setTimeout(() => setControls(false), HINT_DURATION);
    }
    // ... unless the reader starts using them
    for (const bar of [toolbar, footer]) {
      for (const type of ["pointerdown", "focusin"]) listen(bar, type, () => clearTimeout(hintTimer));
    }
    cleanups.push(() => clearTimeout(hintTimer));

    // Immersive, with a mouse, the toolbars show while it's at the very top
    // or bottom, or over them, as a tap in the middle shows them. Touches
    // make mouse moves too, which aren't the mouse.
    let lastTouch = 0;
    function onMouseAt(y, target) {
      if (!isImmersive() || Date.now() - lastTouch < 1000) return;
      const bounds = root.getBoundingClientRect();
      const atEdge = y - bounds.top < HOVER_EDGE || bounds.bottom - y < HOVER_EDGE;
      const overBars = !!target && (toolbar.contains(target) || footer.contains(target));
      if (atEdge || overBars) {
        // Shown for the hint, or a tap, they're now the mouse's to hide
        if (!hoverShown) setControls(true, true);
        else cancelHoverHide();
      } else if (hoverShown && !hoverTimer) {
        hoverTimer = setTimeout(hideHovered, 300);
      }
    }
    function hideHovered() {
      hoverTimer = 0;
      // Kept while the keyboard is in them
      if (hoverShown && !root.querySelector(".ep-toolbar :focus-visible, .ep-footer :focus-visible")) setControls(false);
    }
    listen(root, "pointermove", (e) => {
      if (e.pointerType === "mouse") onMouseAt(e.clientY, e.target);
    });
    listen(root, "pointerleave", (e) => {
      if (e.pointerType === "mouse" && hoverShown) hoverTimer ||= setTimeout(hideHovered, 300);
    });
    session.on("mousemove", ({ y }) => onMouseAt(y, null));
    const touched = () => (lastTouch = Date.now());
    session.on("touchstart", touched);
    listen(root, "touchstart", touched, { passive: true });
    cleanups.push(cancelHoverHide);

    // Immersive: the page fills the reader, without the arrows and margins,
    // and the toolbars float over it, shown by a tap in the middle. That's
    // fullscreen, and phones and tablets held upright, and phones on their
    // side, unless opts.immersive is false.
    const isImmersive = () => root.classList.contains("ep-immersive");
    const immersiveQuery = matchMedia(IMMERSIVE_MEDIA);
    function updateImmersive() {
      const on = isFullscreen() || (opts.immersive !== false && immersiveQuery.matches);
      root.classList.toggle("ep-immersive", on);
      setControls(false);
    }
    listen(immersiveQuery, "change", updateImmersive);

    function setFullscreen(on) {
      if (on === isFullscreen()) return;
      root.classList.toggle("ep-fullscreen", on);
      $("fullscreen-button").setAttribute("aria-pressed", String(on));
      updateImmersive();
      opts.onFullscreenChange?.(on);
      // A host that shows its window fullscreen itself (browserFullscreen: false) does so from onFullscreenChange
      if (opts.browserFullscreen === false) return;
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
    updateImmersive();
    reader.setFullscreen = (on) => setFullscreen(!!on);
    if (pendingFullscreen !== undefined) setFullscreen(pendingFullscreen);

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
    $("search-button").hidden = !capabilities.search || !buttons.search;
    $("search-button").onclick = () => {
      openPanel(searchPanel);
      $("search-input").focus();
    };

    /* ---------- Table of contents ---------- */

    /** Flat, document-ordered list of TOC entries with their index in the book */
    const tocEntries = [];

    function buildToc(items) {
      const list = document.createElement("ol");
      for (const item of items) {
        const li = document.createElement("li"),
          a = document.createElement("a");
        a.textContent = item.label.trim();
        a.href = "#";
        a.onclick = (e) => {
          e.preventDefault();
          if (item.target != null) session.display(item.target);
          closePanels();
        };
        li.appendChild(a);
        tocEntries.push({ label: a.textContent, index: item.index, link: a });
        if (item.subitems && item.subitems.length) {
          li.appendChild(buildToc(item.subitems));
        }
        list.appendChild(li);
      }
      return list;
    }

    session.toc.then((items) => {
      if (items.length) {
        $("toc").replaceChildren(buildToc(items));
      } else {
        const text = document.createElement("p");
        text.className = "ep-message";
        text.textContent = t("toc.empty");
        $("toc").replaceChildren(text);
      }
      const loc = session.location();
      if (loc) updateLocation(loc);
    });

    /** The TOC entry covering the given index in the book */
    function currentTocEntry(index) {
      let best = null;
      for (const entry of tocEntries) {
        if (entry.index < 0 || entry.index > index) continue;
        if (!best || entry.index > best.index) best = entry;
      }
      return best;
    }

    /* ---------- Location display ---------- */

    function updateLocation(loc) {
      const entry = currentTocEntry(loc.index);
      chapter.textContent = entry ? entry.label : "";
      for (const e of tocEntries) e.link.classList.toggle("ep-active", e === entry);

      const parts = [];
      if (loc.page !== null) {
        parts.push(t("location.pageOf", { page: loc.page, total: loc.totalPages }));
        // Replace rather than push, so page turns don't fill the history
        history.replaceState(history.state, "", "#loc=" + loc.page);
        $("corner-info").textContent = t("location.corner", { page: loc.page, total: loc.totalPages });
        parts.push(t("percent", { percent: Math.round(loc.progress * 100) }));
        if (document.activeElement !== progress) {
          progress.value = Math.round(loc.progress * 1000);
        }
      } else if (!pagesReady) {
        parts.push(t("location.countingPages"));
      }
      const left = loc.pagesLeftInChapter;
      if (left != null) {
        parts.push(left > 0 ? t("location.pagesLeftInChapter", { count: left }) : t("location.lastPageInChapter"));
      }
      pageInfo.textContent = parts.join(t("location.separator"));
    }

    session.on("rendered", () => {
      root.classList.remove("ep-loading-book");
      hintControls();
    });
    session.on("relocated", (loc) => {
      viewer.classList.toggle("ep-cover", !!loc.cover);
      hideMenu();
      updateBookmarkButton(loc);
      updateLocation(loc);
      store.set(keys.position, loc.start);
      reportLocation(loc);
    });

    /** Tells opts.onLocationChange where the reader is; page numbers and progress once they're known */
    function reportLocation(loc) {
      if (!opts.onLocationChange || !loc) return;
      opts.onLocationChange({
        // `cfi` is from when epubier only read ePubs
        ...(format.id === "epub" && { cfi: loc.start }),
        location: loc.start,
        progress: loc.progress,
        page: loc.page,
        totalPages: loc.totalPages,
      });
    }

    session.pages.then(
      () => {
        if (destroyed) return;
        pagesReady = true;
        root.classList.remove("ep-counting-pages");
        renderNotes();
        progress.disabled = false;
        if (pendingPage !== null) {
          session.displayPage(pendingPage);
          pendingPage = null;
        } else {
          const loc = session.location();
          if (loc) {
            updateLocation(loc);
            reportLocation(loc);
          }
        }
      },
      () => {}, // reported by session.opened, or by opening it
    );

    progress.onchange = () => {
      session.displayProgress(progress.value / 1000);
    };

    /* ---------- Bookmarks & highlights ---------- */

    // Saved with each one's location as `cfi`, from when that's all it could be
    const savedAnnotations = store.getJSON(keys.annotations) || {};
    /** @type {Array<{cfi: string, page?: number, chapter: string, created: number}>} */
    const bookmarks = savedAnnotations.bookmarks || [];
    /** @type {Array<{cfi: string, text: string, color: string, chapter: string, created: number}>} */
    const highlights = savedAnnotations.highlights || [];
    const saveAnnotations = () => store.setJSON(keys.annotations, { bookmarks, highlights });

    const byPosition = (a, b) => session.compare(a.cfi, b.cfi);
    /**
     * Page number of the screen a bookmark was made on. Saved with the
     * bookmark; older ones work it out from where the screen started
     */
    const bookmarkPage = (b) => b.page || (session.pageStartingAt || session.pageOf)(b.cfi);
    const currentChapter = () => {
      const loc = session.location();
      return (loc && currentTocEntry(loc.index)?.label) || "";
    };

    /* Bookmarks */

    const bookmarkButton = $("bookmark-button");

    /** Bookmarks that fall on the screen currently shown */
    function bookmarksOnScreen(loc) {
      if (!loc) return [];
      return bookmarks.filter((b) => session.compare(b.cfi, loc.start) >= 0 && session.compare(b.cfi, loc.end) <= 0);
    }

    function updateBookmarkButton(loc = session.location()) {
      const marked = bookmarksOnScreen(loc).length > 0;
      bookmarkButton.setAttribute("aria-pressed", String(marked));
      bookmarkButton.title = `${t(marked ? "toolbar.removeBookmark" : "toolbar.bookmark")} (B)`;
    }

    function toggleBookmark() {
      const loc = session.location();
      if (!loc) return;
      const here = bookmarksOnScreen(loc);
      if (here.length) {
        for (const b of here) bookmarks.splice(bookmarks.indexOf(b), 1);
      } else {
        bookmarks.push({
          cfi: loc.start,
          page: loc.page ?? undefined,
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
      session.highlight(h.cfi, {
        className: "ep-user-highlight",
        style: { fill: HIGHLIGHT_COLORS[h.color], "fill-opacity": "0.45", "mix-blend-mode": "multiply" },
        onClick: ({ rect }) => showMenu(rect, { highlight: h }),
      });
    }
    if (capabilities.highlights) highlights.forEach(showHighlight);

    function removeHighlight(h) {
      session.unhighlight(h.cfi);
      highlights.splice(highlights.indexOf(h), 1);
      saveAnnotations();
      renderNotes();
    }

    /** Show the menu just below a rectangle in the book (in the page's coordinates) */
    function showMenu(rect, target) {
      menuTarget = target;
      $("remove-highlight").hidden = !target.highlight;
      for (const swatch of selectionMenu.querySelectorAll(".ep-swatch")) {
        swatch.setAttribute("aria-pressed", String(target.highlight?.color === swatch.dataset.color));
      }
      selectionMenu.hidden = false;

      // The menu is positioned within the reader
      const bounds = root.getBoundingClientRect();
      const menu = selectionMenu.getBoundingClientRect();
      const left = Math.min(
        Math.max(8, rect.left - bounds.left + rect.width / 2 - menu.width / 2),
        bounds.width - menu.width - 8,
      );
      // Below the text (clear of the phone's own selection menu), else above
      let top = rect.bottom - bounds.top + 10;
      if (top + menu.height > bounds.height - 8) {
        top = rect.top - bounds.top - menu.height - 10;
      }
      selectionMenu.style.left = left + "px";
      selectionMenu.style.top = Math.max(8, top) + "px";
    }

    function hideMenu() {
      selectionMenu.hidden = true;
      menuTarget = null;
    }

    session.on("selected", ({ location: where, text, rect, clear }) => {
      showMenu(rect, { cfi: where, text, clear });
    });
    // A press anywhere else dismisses the menu
    const onPress = (e) => {
      menuWasOpen = !selectionMenu.hidden;
      if (!selectionMenu.contains(e.target)) hideMenu();
    };
    session.on("mousedown", onPress);
    session.on("touchstart", onPress);
    listen(document, "mousedown", onPress);
    listen(document, "touchstart", onPress, { passive: true });

    for (const swatch of selectionMenu.querySelectorAll(".ep-swatch")) {
      swatch.style.background = HIGHLIGHT_COLORS[swatch.dataset.color];
      swatch.onclick = () => {
        const color = swatch.dataset.color;
        if (menuTarget.highlight) {
          const h = menuTarget.highlight;
          session.unhighlight(h.cfi);
          h.color = color;
          showHighlight(h);
        } else {
          if (menuTarget.shared) {
            session.unhighlight(sharedPassage);
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
          menuTarget.clear?.();
        }
        saveAnnotations();
        renderNotes();
        hideMenu();
      };
    }
    $("share-highlight").onclick = () => {
      const where = menuTarget.highlight ? menuTarget.highlight.cfi : menuTarget.cfi;
      const text = menuTarget.highlight ? menuTarget.highlight.text : menuTarget.text;
      sharePassage(where, text);
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
        meta.firstElementChild.setAttribute("aria-label", t("notes.bookmark"));
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
        session.display(cfi);
        closePanels();
      };
      li.append(
        a,
        ...(sharing ? [toolButton(t("notes.share"), $("share-highlight").innerHTML, onShare)] : []),
        toolButton(t("notes.delete"), $("remove-highlight").innerHTML, onDelete),
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
      const where = (note, page) =>
        [note.chapter, pagesReady && t("notes.page", { page: page() })].filter(Boolean).join(t("location.separator"));
      const items = [
        ...bookmarks.map((b) => ({
          cfi: b.cfi,
          where: where(b, () => bookmarkPage(b)) || t("notes.bookmark"),
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
          where: where(h, () => session.pageOf(h.cfi)),
          text: h.text,
          color: h.color,
          onShare: () => sharePassage(h.cfi, h.text),
          onDelete: () => removeHighlight(h),
        })),
      ];
      const list = $("note-list");
      list.replaceChildren(...items.sort(byPosition).map(noteItem));
      if (!items.length) {
        const key = capabilities.highlights ? "notes.empty" : "notes.emptyBookmarksOnly";
        list.append(emptyNote(t(matchMedia(TOUCH_MEDIA).matches ? `${key}Touch` : key)));
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

    const share = ({ url, text }) =>
      shareLink({ title: bookName || document.title, text, url }).then((copied) => {
        if (copied !== null) toast(t(copied ? "share.copied" : "share.failed"));
      });
    const notReady = () => toast(t("share.notReady"));

    function sharePage(page, chapter) {
      if (!pagesReady) return notReady();
      share({ url: pageLink(page), text: chapter });
    }

    function sharePassage(where, text) {
      if (!pagesReady) return notReady();
      const quote = text.trim().replace(/\s+/g, " ");
      share({ url: passageLink(where, session.pageOf(where)), text: t("share.quote", { text: quote }) });
    }

    $("share-button").onclick = () => {
      const loc = session.location();
      if (!loc || loc.page === null) return notReady();
      sharePage(loc.page, currentChapter());
    };

    /* ---------- Search ---------- */

    let searchToken = 0,
      searchHighlight = null;

    function clearSearchHighlight() {
      if (searchHighlight) {
        session.unhighlight(searchHighlight);
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
      status.textContent = t("search.searching", { percent: 0 });
      let count = 0;
      for await (const { done, total, results: matches } of session.search(query)) {
        if (token !== searchToken) return;
        status.textContent = t("search.searching", { percent: Math.round((done / total) * 100) });

        for (const match of matches) {
          count++;
          const entry = currentTocEntry(match.index);
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
            session.display(match.location).then(() => {
              if (!capabilities.highlights) return;
              session.highlight(match.location);
              searchHighlight = match.location;
            });
            // On narrow readers the panel covers the page
            if (root.clientWidth < 700) closePanels();
          };
          li.appendChild(a);
          results.appendChild(li);
        }
      }
      status.textContent = count ? t("search.results", { count }) : t("search.noResults");
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

    cleanups.push(() => {
      searchToken++; // stops a search in progress
      if (nativeFullscreenElement() === root) setFullscreen(false);
      session.destroy();
    });

    return session;
  }

  return reader;
}
