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

export type EpubierBuiltInTheme = "black" | "sepiaDark" | "sepiaLight" | "white";
export type EpubierBuiltInFont = "original" | "literata" | "lora" | "garamond" | "sourceSans" | "atkinson";

export interface EpubierLocation {
  /** The position as an EPUB CFI. */
  cfi: string;
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

export interface EpubierOptions {
  /** Shows a back button in the toolbar, which calls this. Without it there is no back button. */
  onBackPressed?: () => void;
  /** Overrides for the reader's UI styles, by name or as `--custom-properties`. */
  styles?: EpubierStyles;
  /** Extra CSS added to the page alongside the reader's own. */
  css?: string;
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
  /** The text alignment to start with, until the reader chooses one. Default `"justify"`. */
  align?: "justify" | "left" | "right" | "original";
  /** The text size to start with, as a percentage of the book's own. Default `100`. */
  textSize?: 70 | 80 | 90 | 100 | 110 | 120 | 135 | 150 | 175 | 200;
  /** What the book's saved data is keyed by, instead of its URL. Required when `path` is an `ArrayBuffer`. */
  storageKey?: string;
  /** A CFI to open at, instead of the position saved in this browser. A `#loc` link in the URL still takes precedence. */
  position?: string;
  /**
   * How pages refer to the book's images, styles and fonts when it's opened from a file or
   * `ArrayBuffer`: blob URLs (the default) or data URLs.
   */
  replacements?: "blobUrl" | "base64";
  /** Called whenever the position changes. */
  onLocationChange?: (location: EpubierLocation) => void;
  /**
   * Called with the theme in use when the reader opens and whenever one is chosen, so the page
   * around the reader (a title bar, the system bars) can match it.
   */
  onThemeChange?: (theme: EpubierThemeChange) => void;
}

export interface EpubierReader {
  /** The reader's root element, which replaced the element passed in. */
  element: HTMLElement;
  /** The underlying epub.js book. */
  book: Book | null;
  /** The underlying epub.js rendition. */
  rendition: Rendition | null;
  /** Tears the reader down and puts the original element back. */
  destroy(): void;
}

/**
 * Replaces `element` with an ePub reader for the book at `path` (a URL), or for the book whose
 * contents are `path` when it's an `ArrayBuffer`. Give the element (or its container) a height.
 */
export default function epubier(element: HTMLElement, path: string | ArrayBuffer, opts?: EpubierOptions): EpubierReader;
