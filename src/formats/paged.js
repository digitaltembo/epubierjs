import { emitter } from "./events.js";

/** Space between pages in a scroll, in CSS pixels */
const SCROLL_GAP = 8;

/**
 * A session for books made of fixed pages, like PDFs and comics. As pages,
 * it shows one, or two side by side when they'd be nearly as big that way,
 * with the first page on its own like the front of a closed book. As a
 * scroll, the pages are one column as wide as the reader, drawn as they
 * come into view. Locations are page numbers, as strings ("1" is the first
 * page). Pages can be zoomed, from fitting the screen (1).
 *
 * @param {HTMLElement} viewer
 * @param {{
 *   count: number,
 *   aspect: number,
 *   render: (index: number, slot: HTMLElement, size: {width: number, height: number}) => {cancel(): void} | void,
 *   prefetch?: (index: number) => void,
 *   metadata: Promise<{title?: string, creator?: string}>,
 *   toc: Promise<Array<object>>,
 *   search?: (query: string) => AsyncGenerator,
 *   destroy?: () => void,
 * }} pages `count` pages, each `aspect` wide for its height, which `render`
 *   draws (0-based `index`) into `slot`, sized `size` in CSS pixels
 * @param {"paginated" | "scrolled"} [flow] Pages, or a scroll, to start with
 */
export function pagedSession(viewer, pages, flow = "paginated") {
  const events = emitter();
  const { count } = pages;
  const container = document.createElement("div");
  viewer.replaceChildren(container);

  let spread = false,
    /** First and last page (0-based) on screen; first is -1 before the first is shown */
    first = -1,
    last = -1,
    rendered = false,
    /** The layout in use: pages or a scroll */
    layout = null,
    /** How big pages are drawn, compared to fitting the screen */
    zoom = 1;

  function describe() {
    if (first < 0) return null;
    const start = first + 1,
      end = last + 1;
    return {
      start: String(start),
      end: String(end),
      index: start,
      cover: spread && start === 1,
      page: start,
      totalPages: count,
      progress: count > 1 ? (start - 1) / (count - 1) : 1,
      pagesLeftInChapter: null,
      atStart: first === 0,
      atEnd: last >= count - 1,
    };
  }

  /** Tells the reader the pages on screen, when they change */
  function relocated(from, to) {
    if (from === first && to === last) return;
    first = from;
    last = to;
    if (!rendered) {
      rendered = true;
      events.emit("rendered");
    }
    events.emit("relocated", describe());
  }

  function setSpread(value) {
    if (value === spread && rendered) return;
    spread = value;
    events.emit("layout", { spread });
  }

  /** A box for one page, sized in CSS pixels */
  function slotFor(size) {
    const slot = document.createElement("div");
    slot.className = "ep-page";
    slot.style.width = size.width + "px";
    slot.style.height = size.height + "px";
    return slot;
  }

  /** Where the middle of the screen is, as a fraction of what can be scrolled */
  function spot() {
    return {
      x: (container.scrollLeft + container.clientWidth / 2) / container.scrollWidth,
      y: (container.scrollTop + container.clientHeight / 2) / container.scrollHeight,
    };
  }
  function scrollToSpot({ x, y }) {
    container.scrollLeft = x * container.scrollWidth - container.clientWidth / 2;
    container.scrollTop = y * container.scrollHeight - container.clientHeight / 2;
  }

  /* ---------- Pages ---------- */

  function pagesLayout() {
    container.className = "ep-pages";
    let rendering = [];

    /** Pages (0-based) shown together with page `index` */
    function screenOf(index) {
      index = Math.min(Math.max(index, 0), count - 1);
      if (!spread || index === 0) return [index];
      // Pages pair up after the cover: 2–3, 4–5, …
      const start = index % 2 ? index : index - 1;
      return start + 1 < count ? [start, start + 1] : [start];
    }

    /** Whether two pages side by side would be nearly as big as one alone */
    function fitsSpread() {
      const { clientWidth: width, clientHeight: height } = viewer;
      if (width < 900 || count < 3) return false;
      const single = Math.min(width / pages.aspect, height),
        double = Math.min(width / (2 * pages.aspect), height);
      return double >= 0.8 * single;
    }

    /** Shows page `index`, from the top left, or at `at` (from `spot`) */
    function show(index, at) {
      setSpread(fitsSpread());
      const screen = screenOf(index);
      for (const task of rendering) task?.cancel();
      const width = viewer.clientWidth / screen.length,
        height = viewer.clientHeight;
      const scale = Math.min(width / pages.aspect, height) * zoom;
      const size = { width: Math.floor(pages.aspect * scale), height: Math.floor(scale) };
      const slots = screen.map(() => slotFor(size));
      container.replaceChildren(...slots);
      // Zoomed in, the screen scrolls around the pages
      container.classList.toggle("ep-zoomed", zoom > 1);
      if (at) scrollToSpot(at);
      else container.scrollTo(0, 0);
      rendering = screen.map((i, n) => pages.render(i, slots[n], size));
      // The pages either side, so turning to them is quick
      const after = screen[screen.length - 1] + 1;
      for (const i of [after, after + 1, screen[0] - 1, screen[0] - 2]) {
        if (i >= 0 && i < count) pages.prefetch?.(i);
      }
      // Shown again (resized) counts as moved, so the reader hears of it
      first = -1;
      relocated(screen[0], screen[screen.length - 1]);
    }

    return {
      show,
      next() {
        if (last < count - 1) show(last + 1);
      },
      prev() {
        if (first > 0) show(first - 1);
      },
      resize: () => show(first, spot()),
      teardown() {
        for (const task of rendering) task?.cancel();
        container.replaceChildren();
      },
    };
  }

  /* ---------- Scroll ---------- */

  function scrollLayout() {
    container.className = "ep-pages ep-scroll";
    setSpread(false);
    /** Drawings in progress or done, by page */
    const drawn = new Map();
    let slots = [],
      size = null,
      frame = 0;

    const pitch = () => size.height + SCROLL_GAP;

    function build() {
      for (const task of drawn.values()) task?.cancel();
      drawn.clear();
      const width = container.clientWidth * zoom;
      size = { width: Math.floor(width), height: Math.floor(width / pages.aspect) };
      slots = Array.from({ length: count }, (_, i) => {
        const slot = slotFor(size);
        slot.dataset.index = i;
        return slot;
      });
      container.replaceChildren(...slots);
      slots.forEach((slot) => observer.observe(slot));
    }

    // Pages are drawn while they're within a screen of being shown, and let
    // go of after, so a long book doesn't keep every page drawn
    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          const i = Number(target.dataset.index);
          if (isIntersecting && !drawn.has(i)) {
            drawn.set(i, pages.render(i, target, size));
          } else if (!isIntersecting && drawn.has(i)) {
            drawn.get(i)?.cancel();
            drawn.delete(i);
            target.replaceChildren();
          }
        }
      },
      { root: container, rootMargin: "100% 0px" },
    );

    /** The pages on screen, from where the scroll is */
    function locate() {
      const top = container.scrollTop;
      const from = Math.min(count - 1, Math.floor((top + 1) / pitch())),
        to = Math.min(count - 1, Math.floor((top + container.clientHeight - 1) / pitch()));
      relocated(from, Math.max(from, to));
    }
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(locate);
    };
    container.addEventListener("scroll", onScroll, { passive: true });

    build();

    return {
      show(index) {
        index = Math.min(Math.max(index, 0), count - 1);
        container.scrollTop = index * pitch();
        locate();
      },
      // A screen at a time, keeping a strip of the last one in view
      next: () => container.scrollBy({ top: container.clientHeight - 40, behavior: "smooth" }),
      prev: () => container.scrollBy({ top: -(container.clientHeight - 40), behavior: "smooth" }),
      resize() {
        // Keep the same spot on the same page, at the new size
        const at = container.scrollTop / pitch(),
          { x } = spot();
        build();
        container.scrollTop = at * pitch();
        container.scrollLeft = x * container.scrollWidth - container.clientWidth / 2;
        locate();
      },
      teardown() {
        cancelAnimationFrame(frame);
        observer.disconnect();
        container.removeEventListener("scroll", onScroll);
        for (const task of drawn.values()) task?.cancel();
        container.replaceChildren();
      },
    };
  }

  const makeLayout = () => (flow === "scrolled" ? scrollLayout() : pagesLayout());

  const displayPage = (page) => {
    layout ||= makeLayout();
    layout.show(page - 1);
    return Promise.resolve();
  };

  return {
    capabilities: { reflow: false, search: !!pages.search, highlights: false },
    raw: pages.raw,
    on: events.on,

    pages: Promise.resolve(),
    metadata: pages.metadata,
    toc: pages.toc,

    display(target) {
      const page = target === undefined ? 1 : Number(target);
      if (!Number.isInteger(page)) return Promise.reject(new Error(`Not a page: ${target}`));
      return displayPage(page);
    },
    displayPage,
    displayProgress: (fraction) => displayPage(Math.round(fraction * (count - 1)) + 1),
    next: () => layout?.next(),
    prev: () => layout?.prev(),
    location: describe,
    resize() {
      if (first >= 0) layout?.resize();
    },
    setFlow(next) {
      if (next === flow) return Promise.resolve();
      flow = next;
      if (!layout) return Promise.resolve();
      const page = first + 1;
      layout.teardown();
      layout = null;
      first = -1; // so the reader hears where it is in the new layout
      return displayPage(page);
    },
    setZoom(value) {
      if (value === zoom) return;
      zoom = value;
      if (first >= 0) layout?.resize();
    },

    compare: (a, b) => Number(a) - Number(b),
    pageOf: (page) => Number(page),
    search: pages.search,

    destroy() {
      layout?.teardown();
      pages.destroy?.();
    },
  };
}
