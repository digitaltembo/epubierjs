import { template } from "./template.js";
import { injectStyles, applyStyleOverrides } from "./styles.js";
import { createReader } from "./reader.js";
import { translator, bookError } from "./strings.js";

let instances = 0;

/** The extension of a URL's file name, lowercased, or "" */
function extensionOf(url) {
  try {
    const name = new URL(url, location.href).pathname.split("/").pop();
    return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  } catch (e) {
    return "";
  }
}

/**
 * Picks the format for a book: the one `format` names, the only one there
 * is, the one its URL's extension says, or the one its first bytes say.
 * Returns a promise when it had to fetch the book to look at its bytes:
 * just its first kilobyte, when the server takes range requests and the
 * format reads URLs itself (`piecewise`), else all of it. A Blob is given
 * as it is to a format that reads it a piece at a time, and read whole for
 * any other.
 */
function chooseFormat(formats, input, format) {
  const settle = (chosen) =>
    input instanceof Blob && !chosen.piecewise
      ? input.arrayBuffer().then((buffer) => ({ format: chosen, input: buffer }))
      : { format: chosen, input };
  if (format) {
    const chosen = formats.find((f) => f.id === format);
    if (!chosen) throw new TypeError(`epubier: no "${format}" format; this build reads ${formats.map((f) => f.id).join(", ")}`);
    return settle(chosen);
  }
  if (formats.length === 1) return settle(formats[0]);

  const sniff = (buffer) => {
    const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 1024));
    const chosen = formats.find((f) => f.test(bytes));
    if (!chosen) throw bookError("unsupported", { formats: formats.map((f) => f.id).join(", ") });
    return { format: chosen, input: buffer };
  };
  if (input instanceof Blob) {
    return input
      .slice(0, 1024)
      .arrayBuffer()
      .then((head) => settle(sniff(head).format));
  }
  if (typeof input !== "string") return sniff(input);

  const extension = extensionOf(input);
  const chosen = formats.find((f) => f.extensions.includes(extension));
  if (chosen) return { format: chosen, input };
  // Nothing to go by in the name (a blob: URL, an API route); fetch the
  // book and look at its contents
  const fetchBuffer = (headers) =>
    fetch(input, { headers }).then(async (response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return { partial: response.status === 206, buffer: await response.arrayBuffer() };
    });
  return fetchBuffer({ Range: "bytes=0-1023" }).then(async ({ partial, buffer }) => {
    const chosen = sniff(buffer);
    if (!partial) return chosen;
    if (chosen.format.piecewise) return { format: chosen.format, input };
    return sniff((await fetchBuffer({})).buffer);
  });
}

/**
 * Makes an `epubier()` function that reads books in the given formats.
 *
 * @param {Array<object>} formats See EpubierFormat in epubier.d.ts
 */
export function createEpubier(formats) {
  /**
   * Replaces `element` with a reader for the book at `path`, or for the
   * book whose contents are `path` when it's an ArrayBuffer or Blob. See
   * EpubierOptions in epubier.d.ts, or the README, for `opts`.
   *
   * The reader keeps the element's id, classes and inline style, and fills
   * the height it's given (it has no intrinsic height of its own).
   *
   * @param {HTMLElement} element Element to replace with the reader
   * @param {string | ArrayBuffer | Blob} path URL of the book, or its contents
   * @param {object} [opts]
   * @returns {{
   *   element: HTMLElement,
   *   session: object | null,
   *   ready: Promise<object | null>,
   *   book: object | null,
   *   rendition: object | null,
   *   destroy: () => void,
   * }} `session` is what shows the book, once it's open (`ready` resolves to
   *   it, or to null if the book couldn't be opened). For an ePub, `book` and
   *   `rendition` are the underlying epub.js objects. `destroy()` removes
   *   the reader and puts `element` back
   */
  return function epubier(element, path, opts = {}) {
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
    const t = translator(opts.strings);
    root.innerHTML = template(`epubier-${++instances}`, t);

    let extraStyles = null;
    if (opts.css) {
      extraStyles = document.createElement("style");
      extraStyles.textContent = opts.css;
      document.head.appendChild(extraStyles);
    }

    // The reader measures itself, so it has to be on the page first
    element.replaceWith(root);
    const reader = createReader(root, path, opts, t, (input) => chooseFormat(formats, input, opts.format));

    return {
      element: root,
      get session() {
        return reader.session;
      },
      ready: reader.ready,
      // ePubs open straight away, so these are there as soon as this returns
      get book() {
        return reader.session?.raw?.book ?? null;
      },
      get rendition() {
        return reader.session?.raw?.rendition ?? null;
      },
      setFullscreen(on) {
        reader.setFullscreen(on);
      },
      destroy() {
        reader.destroy();
        extraStyles?.remove();
        if (root.parentNode) root.replaceWith(element);
      },
    };
  };
}
