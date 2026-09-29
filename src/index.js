import { template } from "./template.js";
import { injectStyles, applyStyleOverrides } from "./styles.js";
import { createReader } from "./reader.js";

let instances = 0;

/**
 * Replaces `element` with an ePub reader for the book at `path`.
 *
 * The reader keeps the element's id, classes and inline style, and fills
 * the height it's given (it has no intrinsic height of its own).
 *
 * @param {HTMLElement} element Element to replace with the reader
 * @param {string} path URL of the .epub file
 * @param {{
 *   onBackPressed?: () => void,
 *   styles?: Record<string, string>,
 *   css?: string,
 *   themes?: Record<string, object | null> | false,
 *   theme?: string,
 *   fonts?: Record<string, object | null> | false,
 *   font?: string,
 *   align?: "justify" | "left" | "right" | "original",
 *   textSize?: number,
 * }} [opts]
 *   - onBackPressed: shows a back button in the toolbar, which calls this
 *   - styles: UI style overrides, by name (background, page, text, muted,
 *     border, accent, font, fontSize, maxPageWidth) or as --custom-properties
 *   - css: extra CSS rules added alongside the reader's own
 *   - themes: changes to the built-in themes (black, sepiaDark, sepiaLight,
 *     white), or new ones: {label, dark?, ...styles}; null removes one
 *   - theme: the theme to start with, until the reader picks one
 *   - fonts: changes to the built-in fonts (original, literata, lora,
 *     garamond, sourceSans, atkinson), or new ones: {label, family, url?};
 *     null removes one
 *   - font: the font to start with, until the reader picks one
 *   - align: the text alignment to start with (default "justify")
 *   - textSize: the text size to start with, as a percentage of the book's
 *     own: 70, 80, 90, 100 (default), 110, 120, 135, 150, 175 or 200
 * @returns {{
 *   element: HTMLElement,
 *   book: object | null,
 *   rendition: object | null,
 *   destroy: () => void,
 * }} `book` and `rendition` are the underlying epub.js objects; `destroy()`
 *   removes the reader and puts `element` back
 */
export default function epubier(element, path, opts = {}) {
  if (!(element instanceof Element) || !element.parentNode) {
    throw new TypeError("epubier: the first argument must be an element on the page");
  }
  injectStyles();

  const root = document.createElement("div");
  if (element.id) root.id = element.id;
  root.className = element.className;
  root.classList.add("epubier");
  const inlineStyle = element.getAttribute("style");
  if (inlineStyle) root.setAttribute("style", inlineStyle);
  applyStyleOverrides(root, opts.styles);
  root.innerHTML = template(`epubier-${++instances}`);

  let extraStyles = null;
  if (opts.css) {
    extraStyles = document.createElement("style");
    extraStyles.textContent = opts.css;
    document.head.appendChild(extraStyles);
  }

  // The reader measures itself, so it has to be on the page first
  element.replaceWith(root);
  const reader = createReader(root, path, opts);

  return {
    element: root,
    book: reader.book,
    rendition: reader.rendition,
    destroy() {
      reader.destroy();
      extraStyles?.remove();
      if (root.parentNode) root.replaceWith(element);
    },
  };
}
