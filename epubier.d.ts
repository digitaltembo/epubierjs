import type { Book, Rendition } from "epubjs";

/** Names for the reader's UI styles (or any `--custom-property`); see the README's Styles section. */
export type EpubierStyleName =
  | "background"
  | "page"
  | "text"
  | "muted"
  | "border"
  | "accent"
  | "font"
  | "fontSize"
  | "maxPageWidth";

export type EpubierStyles = Partial<Record<EpubierStyleName | `--${string}`, string>>;

/** A theme in the settings tab: a label, whether its page is dark, and any style values. */
export interface EpubierTheme extends EpubierStyles {
  label?: string;
  /** Whether the page is dark; worked out from `page` when left out. */
  dark?: boolean;
}

/** A font in the settings tab. */
export interface EpubierFont {
  label: string;
  /** A CSS font-family for the book's text. Leave it out to keep the book's own fonts. */
  family?: string;
  /** A stylesheet that provides `family`, loaded only when the font is chosen. */
  url?: string;
}

/**
 * The reader's text, shaped like `epubier/strings.json` (its English defaults): any of it, nested the same way, to
 * change or translate it. `{name}` in a string is filled in; a string that varies by number is an object of plural
 * forms keyed by `Intl.PluralRules` category (`one`, `few`, `many`, `other`, …) for `locale`.
 */
export interface EpubierStrings {
  /** The language the strings are in, for choosing plural forms. Default `"en"`. */
  locale?: string;
  [key: string]: string | EpubierStrings | undefined;
}

export type EpubierBuiltInTheme = "black" | "sepiaDark" | "sepiaLight" | "white";
export type EpubierBuiltInFont = "original" | "literata" | "lora" | "garamond" | "sourceSans" | "atkinson";

export interface EpubierLocation {
  /** The position in the format's own terms: an EPUB CFI for ePubs and Kindle books, a page number for PDFs and comics. */
  location: string;
  /** The position as an EPUB CFI; for ePubs only. */
  cfi?: string;
  /** How far through the book, 0–1; null until the pages have been counted. */
  progress: number | null;
  page: number | null;
  totalPages: number | null;
}

export interface EpubierThemeChange {
  /** The theme's id: a built-in theme's, or one added with `themes`. */
  id: string;
  /** The reader's background color, as computed (e.g. `"rgb(28, 24, 19)"`). */
  background: string;
  /** Whether that background is dark. */
  dark: boolean;
}

/** Where PDF.js finds its files. See the README's PDFs section. */
export interface EpubierPdfOptions {
  /** URL of PDF.js's worker script, `pdf.worker.min.mjs`. */
  workerSrc?: string;
  /** URL of a copy of the pdfjs-dist package's folder, for its `cmaps/`, `standard_fonts/` and `wasm/`. */
  assetsUrl?: string;
}

/** Where the worker that reads .cbr and .cb7 comics is. See the README's Comics section. */
export interface EpubierComicArchiveOptions {
  /** URL of epubier's `dist/comicarchive.worker.js`, with `libarchive.wasm` beside it. */
  workerUrl?: string;
}

/** The toolbar's buttons, by name. */
export interface EpubierToolbar {
  back?: boolean;
  /** Contents, notes and settings. */
  contents?: boolean;
  /** Also turns off its key, B. */
  bookmark?: boolean;
  /** Also turns off its key, F. */
  fullscreen?: boolean;
  share?: boolean;
  /** Shown only for formats that can search. */
  search?: boolean;
}

export interface EpubierOptions {
  /**
   * The book's format, by id (`"epub"`, `"pdf"`, `"comic"`, `"comicarchive"`, `"mobi"`), when it can't be told from its URL's
   * extension or its contents. Only matters to a reader with more than one format.
   */
  format?: string;
  /** Where PDF.js finds its files. */
  pdf?: EpubierPdfOptions;
  /** Where the worker that reads .cbr and .cb7 comics is. */
  comicArchive?: EpubierComicArchiveOptions;
  /** Shows a back button in the toolbar, which calls this. Without it there is no back button. */
  onBackPressed?: () => void;
  /** Whether links to a page or passage can be shared: `false` leaves out the toolbar's, a selection's and the notes' share buttons. Default `true`. */
  share?: boolean;
  /** Which of the toolbar's buttons to show; each is shown unless `false` (back only with `onBackPressed`). */
  toolbar?: EpubierToolbar;
  /**
   * Whether the toolbar is the title bar of a window without one (an Electron window with `titleBarStyle: "hidden"`,
   * a web app's window controls overlay): dragging it moves the window. Keep the window's buttons clear of it with
   * `--ep-toolbar-inset-left` and `--ep-toolbar-inset-right` in `styles`. Default `false`.
   */
  titleBar?: boolean;
  /** Overrides for the reader's UI styles, by name or as `--custom-properties`. */
  styles?: EpubierStyles;
  /** Extra CSS added to the page alongside the reader's own. */
  css?: string;
  /** Changes to the reader's text, to reword or translate it. See `EpubierStrings`. */
  strings?: EpubierStrings;
  /**
   * Changes to the themes in the settings tab: an entry for a built-in theme changes just the values
   * it gives, `null` removes one, and any other name adds one. `false` removes them all.
   */
  themes?: Partial<Record<EpubierBuiltInTheme, Partial<EpubierTheme> | null>> & Record<string, EpubierTheme | null> | false;
  /** The theme to start with, until the reader chooses one. Default `"white"`. */
  theme?: EpubierBuiltInTheme | (string & {});
  /** Changes to the fonts in the settings tab, the same way as `themes`. `false` removes them all. */
  fonts?: Partial<Record<EpubierBuiltInFont, Partial<EpubierFont> | null>> & Record<string, EpubierFont | null> | false;
  /** The font to start with, until the reader chooses one. Default `"original"`, the book's own. */
  font?: EpubierBuiltInFont | (string & {});
  /**
   * Whether phones and tablets held upright, and phones on their side, get the immersive layout:
   * the page fills the reader, and a tap in the middle shows the toolbars, as in fullscreen. Default `true`.
   */
  immersive?: boolean;
  /** Pages or one long scroll, to start with until the reader chooses one. Default `"paginated"`. */
  flow?: "paginated" | "scrolled";
  /**
   * How pages turn, to start with until the reader chooses: the page sliding off to the left (`"slide"`, the
   * default), or straight to the next (`"none"`). Pages never slide where the system asks for reduced motion.
   */
  pageTurn?: "slide" | "none";
  /** The text alignment to start with, until the reader chooses one. Default `"justify"`. */
  align?: "justify" | "left" | "right" | "original";
  /** The text size to start with, as a percentage of the book's own. Default `100`. */
  textSize?: 70 | 80 | 90 | 100 | 110 | 120 | 135 | 150 | 175 | 200;
  /** For PDFs and comics, the zoom to start with until the reader chooses one, in percent of fitting the screen. Default `100`. */
  zoom?: 50 | 75 | 100 | 125 | 150 | 200 | 250 | 300 | 400;
  /** What the book's saved data is keyed by, instead of its URL. Required when `path` is an `ArrayBuffer` or `Blob`. */
  storageKey?: string;
  /**
   * A location to open at (an `EpubierLocation`'s `location`: a CFI, or a page number for PDFs and comics),
   * instead of the position saved in this browser. A `#loc` link in the URL still takes precedence.
   */
  position?: string;
  /**
   * How pages refer to the book's images, styles and fonts when it's opened from a file or
   * `ArrayBuffer`: blob URLs (the default) or data URLs.
   */
  replacements?: "blobUrl" | "base64";
  /** Called whenever the position changes. */
  onLocationChange?: (location: EpubierLocation) => void;
  /**
   * Called whenever the reader goes in or out of fullscreen: by its button, its key (F), Escape, leaving the
   * browser's fullscreen, or `setFullscreen`.
   */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /**
   * Whether the reader's fullscreen also shows it in the browser's fullscreen. Set `false` where the host shows its
   * window fullscreen itself (a desktop app's), from `onFullscreenChange`, and calls `setFullscreen` when the window
   * goes in or out of fullscreen on its own. Default `true`.
   */
  browserFullscreen?: boolean;
  /**
   * Called with the theme in use when the reader opens and whenever one is chosen, so the page
   * around the reader (a title bar, the system bars) can match it.
   */
  onThemeChange?: (theme: EpubierThemeChange) => void;
}

export interface EpubierReader {
  /** The reader's root element, which replaced the element passed in. */
  element: HTMLElement;
  /** What shows the book, once it's open; ePubs open straight away. */
  readonly session: EpubierSession | null;
  /** Resolves to the session once the book is open, or to null if it couldn't be opened. */
  ready: Promise<EpubierSession | null>;
  /** The underlying epub.js book, for ePubs and Kindle books (once open). */
  readonly book: Book | null;
  /** The underlying epub.js rendition, for ePubs and Kindle books (once open). */
  readonly rendition: Rendition | null;
  /**
   * Turns the reader's fullscreen on or off, as its button does (once the book is open, if it isn't yet), e.g. when
   * the window it's in goes fullscreen.
   */
  setFullscreen(on: boolean): void;
  /** Tears the reader down and puts the original element back. */
  destroy(): void;
}

export type Epubier = (element: HTMLElement, path: string | ArrayBuffer | Blob, opts?: EpubierOptions) => EpubierReader;

/* ---------- Formats ---------- */

/** An entry in a book's table of contents. */
export interface EpubierTocItem {
  label: string;
  /** What to pass to `display()` to go there, or null if it goes nowhere. */
  target: string | null;
  /** Where it is in the book, comparable with `EpubierScreen.index`; -1 if unknown. */
  index: number;
  subitems: EpubierTocItem[];
}

/** Where a session is: the screen shown. Locations are opaque strings that the session's `compare` orders. */
export interface EpubierScreen {
  start: string;
  end: string;
  /** Where the screen is in the book, comparable with `EpubierTocItem.index`, for the current chapter. */
  index: number;
  /** Whether it's a cover shown across a spread (no gutter line). */
  cover?: boolean;
  /** The page number and total, and how far through (0–1); null until known. */
  page: number | null;
  totalPages: number | null;
  progress: number | null;
  /** Pages left in the chapter, where the format knows. */
  pagesLeftInChapter?: number | null;
  /** Whether it's the first or last screen, so there's no turning back or on. */
  atStart?: boolean;
  atEnd?: boolean;
}

export interface EpubierLook {
  /** The theme's text and accent colors, and whether its page is dark. */
  text: string;
  accent: string;
  dark: boolean;
  /** For reflowable books only: */
  font: EpubierFont | null;
  align: "justify" | "left" | "right" | null;
  textSize: number;
}

/**
 * Shows one open book; a format opens it. The reader (toolbar, panels, bookmarks, settings, links) is
 * built around it, and leaves out what its `capabilities` say it can't do.
 */
export interface EpubierSession {
  capabilities: {
    /** The text reflows, so the font, text size and alignment settings apply. */
    reflow: boolean;
    search: boolean;
    /** Text can be selected and highlighted (and shared passages shown). */
    highlights: boolean;
  };
  /** The format's own objects, e.g. `{ book, rendition }` for ePubs, `{ pdf }` for PDFs. */
  raw: Record<string, unknown>;
  /**
   * Events: "relocated" (EpubierScreen), "rendered", "layout" ({ spread }), "selected" ({ location, text, rect, clear }),
   * and, for books shown in an iframe, "click" ({ x, target }), "mousemove" ({ y }), "keydown", "touchstart", "touchend"
   * and "mousedown". `x` and `y` are relative to the window.
   */
  on(type: string, handler: (...args: any[]) => void): void;

  /** Rejects if the book can't be opened, for formats that only find out after `open` returns. */
  opened?: Promise<unknown>;
  /** Resolves once page numbers are known. */
  pages: Promise<unknown>;
  metadata: Promise<{ title?: string; creator?: string }>;
  toc: Promise<EpubierTocItem[]>;

  display(target?: string): Promise<unknown>;
  displayPage(page: number): Promise<unknown>;
  displayProgress(fraction: number): Promise<unknown>;
  next(): void;
  prev(): void;
  location(): EpubierScreen | null;
  resize(): void;

  compare(a: string, b: string): number;
  pageOf(location: string): number;
  pageStartingAt?(location: string): number;

  setLook?(look: EpubierLook): Promise<unknown> | void;
  /** Changes between pages and a scroll, staying at the same place; without it, there's no layout setting. */
  setFlow?(flow: "paginated" | "scrolled"): Promise<unknown>;
  /** Draws pages bigger or smaller than fitting the screen (1); with it, there's a zoom setting. */
  setZoom?(zoom: number): void;
  search?(query: string): AsyncIterable<{
    done: number;
    total: number;
    results: Array<{ location: string; excerpt: string; index: number }>;
  }>;
  /** With `capabilities.highlights`: */
  highlight?(location: string, options?: { className?: string; style?: Record<string, string>; onClick?: (target: { rect: DOMRect; text: string }) => void }): void;
  unhighlight?(location: string): void;
  /** A location as it goes in a `#loc=…&hl=…` link, and back. */
  toLink?(location: string): string;
  fromLink?(text: string): string;

  destroy(): void;
}

/** What a format's `open` is given besides the viewer and the book. */
export interface EpubierFormatContext {
  opts: EpubierOptions;
  /** localStorage, or nothing when it's unavailable. */
  store: { get(key: string): string | null; set(key: string, value: string): void };
  /** This book's storage keys, e.g. `locations` for a cache of page numbers. */
  keys: { position: string; locations: string; annotations: string };
  /** Pages or a scroll, for sessions with `setFlow` to start as. */
  flow: "paginated" | "scrolled";
  /** The reader's text (see `EpubierStrings`): a dotted key, e.g. `"toc.start"`, with `{name}`s filled in from `vars`. */
  t(key: string, vars?: Record<string, string | number>): string;
}

export type EpubierOpen = (
  viewer: HTMLElement,
  input: string | ArrayBuffer | Blob,
  ctx: EpubierFormatContext,
) => EpubierSession | Promise<EpubierSession>;

/** A kind of book the reader can open: `epubier/formats/epub`, `…/pdf`, `…/comic`, `…/comicarchive`, `…/mobi`, or your own. */
export interface EpubierFormat {
  /** Names it in the `format` option, and prefixes its books' saved data. */
  id: string;
  /** File extensions (without the dot, lowercase) that are this format. */
  extensions: string[];
  /** Whether a book's first bytes (up to 1024) are this format. */
  test(bytes: Uint8Array): boolean;
  /**
   * Whether it reads a URL or `Blob` itself, only the parts it needs: then it's given them as they are (a URL whose
   * extension doesn't tell its format once its first kilobyte has been fetched, with a range request, to tell).
   * Otherwise it's given the whole book, fetched or read, as an `ArrayBuffer`.
   */
  piecewise?: boolean;
  /** Opens a book; or `load`, to fetch the code that does only once it's needed. */
  open?: EpubierOpen;
  load?: () => Promise<{ open: EpubierOpen }>;
}

/**
 * Replaces `element` with an ePub reader for the book at `path` (a URL), or for the book whose
 * contents are `path` when it's an `ArrayBuffer` or `Blob`. Give the element (or its container) a height.
 * For other formats, see `epubier/all` and `epubier/core`.
 */
declare const epubier: Epubier;
export default epubier;
