// epub.js's own ES modules, the same ones patches.js changes. Plain "epubjs" is
// its CommonJS build to a bundler that reads `main` rather than `module`, which
// would be a second copy the patches never reach.
import ePub from "epubjs/src/index.js";
import "./patches.js";
import { emitter } from "../events.js";

/**
 * A cover page's layout (see the content hook): one column as wide as the
 * screen, the image as big as fits, centred. 40px is epub.js's padding above
 * and below the page.
 */
const COVER_CSS = `
  body { column-width: 100000px !important; text-align: center !important; }
  body * { margin-left: auto !important; margin-right: auto !important; }
  img { display: block !important; width: auto !important; height: auto !important; max-width: 100% !important; max-height: calc(100vh - 40px) !important; }
  svg { display: block !important; width: 100% !important; height: calc(100vh - 40px) !important; }
`;

/**
 * Opens an ePub in `viewer`. Locations are CFIs. See EpubierSession in
 * epubier.d.ts for what the reader asks of a session.
 *
 * @param {HTMLElement} viewer
 * @param {string | ArrayBuffer} input URL of the .epub, or its contents
 * @param {{opts: object, store: object, keys: {locations: string}, flow?: "paginated" | "scrolled"}} ctx
 *   `flow`: pages, or one long scroll, to start with
 */
/** epub.js makes two-page spreads from this wide (styles.js relies on it) */
const MIN_SPREAD_WIDTH = 900;
/** The text width a page is kept to: that of a page of a spread, about 60 characters */
const PAGE_TEXT_WIDTH = 440;
/** The most margin a page has either side, as in a spread */
const MAX_PAGE_MARGIN = 44;

/**
 * The gap between columns, which epub.js also puts half of either side as
 * the page's margins, for a viewer `width` wide. A spread has epub.js's own
 * (a twelfth of the width). A page on its own has wider margins, up to a
 * spread's, to keep its text to a spread page's width, but never narrower
 * than epub.js's, on a phone.
 */
function pageGap(width) {
  if (width >= MIN_SPREAD_WIDTH) return undefined;
  const even = (n) => Math.max(0, Math.floor(n / 2) * 2);
  return Math.min(2 * MAX_PAGE_MARGIN, Math.max(even(width / 12), even(width - PAGE_TEXT_WIDTH)));
}

export function open(viewer, input, { opts, store, keys, flow: initialFlow }) {
  const events = emitter();
  const book = ePub(input, opts.replacements ? { replacements: opts.replacements } : undefined);

  // The rendition shows the book, as pages or as a scroll. Changing between
  // them takes a new one (with a different view manager), so it's made by
  // render(), below, which sets it up and redoes the highlights.
  let flow = initialFlow === "scrolled" ? "scrolled" : "paginated",
    rendition = null,
    /** Hooks the rendition added to the book, which would outlive it */
    renditionHooks = [];
  const coverSections = new Set();

  /* ---------- Look: theme colors, font, alignment, text size ---------- */

  let look = { font: null, align: null, textSize: 100 },
    themeCss = "";

  /** The book's CSS for the current look */
  function bookCss() {
    const { font, align, textSize } = look;
    const fontCss = font?.family
      ? `body, body *:not(code):not(pre):not(kbd):not(samp) { font-family: ${font.family} !important; }`
      : "";
    // Justified text is hyphenated. That's set on the whole book up front
    // (rather than with the alignment, which applies once a chapter is
    // shown), so that aligning changes no line breaks and so no pages.
    const alignCss = align
      ? `[data-ep-align] { text-align: ${align} !important; }
        ${align === "justify" ? "body { hyphens: auto; -webkit-hyphens: auto; }" : ""}`
      : "";
    // Books size their text relative to the root (em, rem, %), so scaling
    // the root scales the book
    const sizeCss = textSize !== 100 ? `html { font-size: ${textSize}% !important; }` : "";
    return themeCss + fontCss + alignCss + sizeCss;
  }

  /** Adds (or updates) the look's styles and font stylesheet in a book document */
  function addStyles(doc) {
    const head = doc.getElementsByTagName("head")[0];
    if (!head) return;
    const { font } = look;
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
      } else if (!link.loaded) {
        // A chapter shown before comes with the link already in it (epub.js
        // keeps the document), so it's loaded or on its way
        link.loaded = link.sheet ? Promise.resolve() : new Promise((resolve) => (link.onload = link.onerror = resolve));
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
    const family = look.font?.family;
    return Promise.race([
      Promise.resolve(link?.loaded)
        .then(() => family && doc.fonts.load(`1em ${family}`))
        .then(() => doc.fonts.ready)
        .catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }

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

  // Where to return to after the text reflows (a new font or alignment, or
  // a change between pages and a scroll).
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
    await show(cfi);
    reflowAnchor = { cfi, landing: rendition.currentLocation()?.start?.cfi };
  }

  /**
   * Shows `target`. In a scroll, epub.js then adds the chapters either side,
   * and misjudges how far the one above pushes the text down, so it ends up
   * past the place; with them in, showing it again lands right. Unless the
   * reader has gone somewhere else meanwhile.
   */
  let shows = 0,
    /** The change between pages and a scroll under way */
    switching = Promise.resolve();
  function show(target) {
    const current = ++shows;
    const shown = rendition.display(target);
    if (flow !== "scrolled") return shown;
    return shown
      .then(() => new Promise((resolve) => setTimeout(resolve, 500)))
      .then(() => current === shows && rendition.display(target));
  }

  /* ---------- Page numbers ---------- */

  const cfiCompare = (a, b) => new ePub.CFI().compare(a, b);

  let pagesReady = false,
    /** Page just jumped to, kept as the page number for the screen it lands on */
    requestedPage = null,
    spread = false;

  const pages = book.ready
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
      pagesReady = true;
    });

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

  /** An epub.js location as the reader takes it */
  function describe(loc) {
    if (!loc?.start) return null;
    const ready = pagesReady && book.locations.length() > 0;
    const { displayed } = loc.start;
    let pagesLeftInChapter = null;
    if (flow === "paginated" && displayed && displayed.total > 1) {
      // In a spread, the right-hand page is already on screen too
      pagesLeftInChapter = Math.max(0, displayed.total - displayed.page - (spread ? 1 : 0));
    }
    return {
      start: loc.start.cfi,
      end: loc.end.cfi,
      index: loc.start.index,
      cover: coverSections.has(loc.start.index),
      page: ready ? currentPage(loc) : null,
      totalPages: ready ? book.locations.length() : null,
      progress: ready ? book.locations.percentageFromCfi(loc.start.cfi) : null,
      pagesLeftInChapter,
      atStart: !!loc.atStart,
      atEnd: !!loc.atEnd,
    };
  }

  /** A range's rectangle in the page's coordinates, rather than its (very wide, scrolled) iframe's */
  function rectOf(range) {
    const frame = range.startContainer.ownerDocument.defaultView.frameElement.getBoundingClientRect();
    const rect = range.getBoundingClientRect();
    return new DOMRect(frame.left + rect.left, frame.top + rect.top, rect.width, rect.height);
  }

  /* ---------- Table of contents ---------- */

  function spineIndex(href) {
    const section = book.spine.get(href);
    if (section) return section.index;
    const file = href.split("#")[0].split("/").pop();
    const match = book.spine.spineItems.find((item) => item.href.split("/").pop() === file);
    return match ? match.index : -1;
  }

  /* ---------- Highlights ---------- */

  /** Highlights by location, to redo in a new rendition */
  const marks = new Map();
  function mark(cfi, { className, style, onClick } = {}) {
    rendition.annotations.highlight(
      cfi,
      {},
      (e) => {
        // Marks also report touchstart; only a real tap counts
        if (e.type !== "click") return;
        const range = rendition.getRange(cfi);
        if (range) onClick?.({ rect: rectOf(range), text: range.toString() });
      },
      className,
      style,
    );
  }

  /* ---------- Rendition ---------- */

  function render() {
    const hookCount = book.spine.hooks.content.hooks.length;
    rendition = book.renderTo(
      viewer,
      flow === "scrolled"
        ? { width: "100%", height: "100%", manager: "continuous", flow: "scrolled", spread: "none" }
        : {
            width: "100%",
            height: "100%",
            flow: "paginated",
            spread: "auto",
            minSpreadWidth: MIN_SPREAD_WIDTH,
            // Read again at each layout, as epub.js copies it as it is
            get gap() {
              return pageGap(viewer.clientWidth);
            },
          },
    );
    renditionHooks = book.spine.hooks.content.hooks.slice(hookCount);

    rendition.themes.default({
      "::selection": { background: "rgba(255, 220, 0, 0.35)" },
      ".epubjs-hl": { fill: "yellow", "fill-opacity": "0.4", "mix-blend-mode": "multiply" },
      // Pages have epub.js's margins; a scroll has none of its own
      ...(flow === "scrolled" && { body: { padding: "1.5rem 6% !important" } }),
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

    // A cover page (just an image, at the start of the book) is shown on its
    // own, centred across a two-page spread like the front of a closed book,
    // rather than as a left-hand page beside a blank one. Its one column spans
    // the spread: a stylesheet's !important beats the column width epub.js
    // sets inline, however often it lays the page out again. In a scroll it
    // stays as it is: sized to the screen, it would shrink the chapter it
    // sizes itself by.
    rendition.hooks.content.register((contents) => {
      const doc = contents.document;
      const index = contents.sectionIndex;
      if (index > 1 || doc.body.textContent.trim() || !doc.body.querySelector("img, svg, image")) return;
      coverSections.add(index);
      if (flow !== "paginated") return;
      const style = doc.createElement("style");
      style.textContent = COVER_CSS;
      doc.head.append(style);
      contents.expand();
    });

    rendition.hooks.content.register(styleContents);

    rendition.on("rendered", () => events.emit("rendered"));
    // A scroll is one column, whatever epub.js makes of the width
    rendition.on("layout", (layout) => {
      spread = flow === "paginated" && layout.divisor === 2;
      events.emit("layout", { spread });
    });
    if (flow === "scrolled") {
      spread = false;
      events.emit("layout", { spread });
    }
    rendition.on("relocated", (loc) => {
      const where = describe(loc);
      requestedPage = null;
      events.emit("relocated", where);
    });
    // Events inside the book's iframe don't reach the reader's own elements
    for (const type of ["keydown", "touchstart", "touchend", "mousedown"]) {
      rendition.on(type, (e) => events.emit(type, e));
    }
    rendition.on("click", (e, contents) => {
      const selection = contents.window.getSelection();
      if (selection && !selection.isCollapsed) return;
      // clientX is relative to the (very wide, scrolled) iframe
      const frame = contents.window.frameElement.getBoundingClientRect();
      events.emit("click", { x: e.clientX + frame.left, target: e.target });
    });
    rendition.on("mousemove", (e, contents) => {
      const frame = contents.window.frameElement.getBoundingClientRect();
      events.emit("mousemove", { y: e.clientY + frame.top });
    });
    rendition.on("selected", (cfiRange, contents) => {
      const range = contents.range(cfiRange);
      if (!range || range.collapsed) return;
      events.emit("selected", {
        location: cfiRange,
        text: range.toString(),
        rect: rectOf(range),
        clear: () => contents.window.getSelection().removeAllRanges(),
      });
    });

    for (const [cfi, options] of marks) mark(cfi, options);
  }
  render();

  const tocItems = (items) =>
    items.map((item) => ({
      label: item.label,
      target: item.href,
      index: spineIndex(item.href),
      subitems: tocItems(item.subitems || []),
    }));

  return {
    capabilities: { reflow: true, search: true, highlights: true },
    get raw() {
      return { book, rendition };
    },
    on: events.on,

    opened: book.opened,
    pages,
    metadata: book.loaded.metadata.then((meta) => ({ title: meta.title, creator: meta.creator })),
    toc: book.loaded.navigation.then((nav) => tocItems(nav.toc)),

    display(target) {
      try {
        // A range here never finishes displaying when its chapter isn't
        // loaded yet, so display its start
        if (target?.startsWith("epubcfi(") && target.includes(",")) {
          const start = new ePub.CFI(target);
          start.collapse(true);
          target = start.toString();
        }
      } catch (e) {
        return Promise.reject(e);
      }
      return show(target);
    },
    displayPage(page) {
      requestedPage = Math.min(Math.max(page, 1), book.locations.length());
      return show(book.locations.cfiFromLocation(requestedPage - 1));
    },
    displayProgress(fraction) {
      return show(book.locations.cfiFromPercentage(fraction));
    },
    next() {
      shows++;
      rendition.next();
    },
    prev() {
      shows++;
      rendition.prev();
    },
    location: () => describe(rendition.location),
    resize() {
      if (!rendition.manager) return;
      rendition.resize();
      // A resize while the last one is still showing the book (the window shrinking as the reader leaves
      // fullscreen) can leave that one's views, at its size, in place: once both are shown, lay out again if so
      rendition.q
        .enqueue(() => {
          const manager = rendition.manager;
          if (!manager?.views) return;
          const { width, height } = manager.viewSettings;
          if (manager.views.all().some((view) => view.settings.width !== width || view.settings.height !== height)) {
            manager._stageSize = undefined;
            rendition.resize();
          }
        })
        .catch(() => {});
    },
    setFlow(next) {
      // One change at a time, each once the rendition has started: one
      // destroyed before then would still start, and fail
      const change = switching.then(async () => {
        if (next === flow) return;
        await rendition.started;
        // Where the screen was, to come back to in the new layout: as last
        // reported, since the reader may have resized for the new layout already
        const start = rendition.location?.start?.cfi;
        const cfi = start && (reflowAnchor?.landing === start ? reflowAnchor.cfi : start);
        flow = next;
        for (const hook of renditionHooks) book.spine.hooks.content.deregister(hook);
        rendition.destroy();
        render();
        if (!cfi) return;
        await show(cfi);
        reflowAnchor = { cfi, landing: rendition.location?.start?.cfi };
      });
      switching = change.catch(() => {});
      return change;
    },

    compare: cfiCompare,
    pageOf: (cfi) => book.locations.locationFromCfi(cfi) + 1,
    /** The first page starting at or after `cfi`, as currentPage() works out a screen's page */
    pageStartingAt(cfi) {
      const loc = book.locations.locationFromCfi(cfi);
      return (cfiCompare(book.locations.cfiFromLocation(loc), cfi) >= 0 ? loc : loc + 1) + 1;
    },
    // In links, without the "epubcfi(…)" wrapper
    toLink: (cfi) => cfi.replace(/^epubcfi\((.*)\)$/, "$1"),
    fromLink: (text) => `epubcfi(${text})`,

    setLook({ text, accent, dark, font, align, textSize }) {
      const reflowing = font !== look.font || align !== look.align || textSize !== look.textSize;
      look = { font, align, textSize };
      // The page color shows through the book; on a dark page, text the book
      // colors itself (usually black) would be unreadable, so it's all recolored
      themeCss = `
        html, body { color: ${text} !important; background: transparent !important; }
        ${dark ? `body *:not(a) { color: inherit !important; background-color: transparent !important; }
        a, a * { color: ${accent} !important; }` : ""}`;
      // epub.js keeps the chapters it has loaded, and shows them again from
      // what it kept, without the hook above that styles them: so they're
      // restyled here, or they'd be laid out the old way and then change
      for (const section of book.spine.spineItems) {
        if (section.document) addStyles(section.document);
      }
      return reflowing ? reflow() : restyle();
    },

    highlight(cfi, options = {}) {
      marks.set(cfi, options);
      mark(cfi, options);
    },
    unhighlight(cfi) {
      marks.delete(cfi);
      rendition.annotations.remove(cfi, "highlight");
    },

    async *search(query) {
      await book.ready;
      const sections = book.spine.spineItems;
      for (const [i, section] of sections.entries()) {
        await section.load(book.load.bind(book));
        const matches = section.find(query);
        section.unload();
        yield {
          done: i + 1,
          total: sections.length,
          results: matches.map((match) => ({ location: match.cfi, excerpt: match.excerpt, index: section.index })),
        };
      }
    },

    destroy() {
      rendition.destroy();
      book.destroy();
    },
  };
}
