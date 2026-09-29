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
 * }} [opts]
 *   - onBackPressed: shows a back button in the toolbar, which calls this
 *   - styles: theme overrides, by name (background, page, text, muted,
 *     border, accent, font, fontSize, maxPageWidth) or as --custom-properties
 *   - css: extra CSS rules added alongside the reader's own
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
