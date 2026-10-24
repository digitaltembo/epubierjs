import { initKf8File, initMobiFile } from "@lingo-reader/mobi-parser";
import { open as openEpub } from "../epub/session.js";
import { buildEpub, escapeXml, htmlDocument } from "../epub/build.js";
import { bookBytes } from "../fetch.js";

/** A KF8 book, or failing that an older MOBI one */
async function parse(bytes) {
  const data = new Uint8Array(bytes);
  try {
    return await initKf8File(data);
  } catch (e) {
    return initMobiFile(data);
  }
}

/**
 * A chapter's HTML as an XHTML document. MOBI markup is HTML, often old and
 * loose; parsing it as HTML and serializing it as XML makes it well formed.
 * Elements and attributes with a prefix (mbp:pagebreak and the like) would
 * need a namespace, and mean nothing to a browser anyway, so they go.
 */
function chapterDocument(html) {
  const doc = htmlDocument(html);
  for (const el of [...doc.body.querySelectorAll("*")]) {
    if (el.tagName.includes(":")) {
      el.replaceWith(...el.childNodes);
      continue;
    }
    for (const attribute of [...el.attributes]) {
      if (attribute.name.includes(":")) el.removeAttribute(attribute.name);
    }
  }
  return doc;
}

/**
 * An older MOBI book's table of contents, from the contents page its guide
 * points to. The parser misses it when the guide lists another page first,
 * as calibre's books do. Flat, since the contents page is just links.
 */
function contentsPage(book, parts) {
  try {
    const head = book.mobiFile.decode(book.mobiFile.loadTextBuffer(0).buffer).split(/<body/i)[0];
    const position = Number(/<reference[^>]*type=["']?toc["']?[^>]*filepos=["']?(\d+)/i.exec(head)?.[1]);
    const chapter = book.getSpine().find((ch) => (ch.end ?? Infinity) > position);
    const part = parts.find((p) => p.id === chapter?.id);
    if (!part) return [];
    return [...part.doc.querySelectorAll('a[href^="filepos:"]')].map((a) => ({
      label: a.textContent.trim(),
      href: a.getAttribute("href"),
    }));
  } catch (e) {
    return [];
  }
}

/**
 * The book as an ePub, so it reads like one. Images and stylesheets stay
 * the parser's blob URLs, which live until it's destroyed.
 */
async function toEpub(book) {
  const meta = book.getMetadata();
  const parts = book.getSpine().map((chapter, i) => {
    const { html, css } = book.loadChapter(chapter.id) || { html: "", css: [] };
    return { id: chapter.id, file: `part${i}.xhtml`, doc: chapterDocument(html), css: css.map((c) => c.href) };
  });

  // A cover page, unless the book starts with a picture of its own
  const cover = book.getCoverImage();
  if (cover && !parts[0]?.doc.querySelector("img")) {
    parts.unshift({ id: null, file: "cover.xhtml", doc: chapterDocument(`<img src="${escapeXml(cover)}" alt="Cover" />`), css: [] });
  }

  // Read before the links below are changed
  const toc = book.getToc()?.length ? book.getToc() : contentsPage(book, parts);

  // Links within the book (kindle:pos:… or filepos:…) go to the chapter
  // file, and to the element they point at when there is one
  let anchors = 0;
  function resolve(href) {
    const target = href && book.resolveHref(href);
    const part = target && parts.find((p) => p.id === target.id);
    if (!part) return null;
    let el = null;
    try {
      el = target.selector && part.doc.querySelector(target.selector);
    } catch (e) {}
    if (!el) return part.file;
    if (!el.id) el.id = `ep-anchor-${++anchors}`;
    return `${part.file}#${el.id}`;
  }
  for (const part of parts) {
    for (const a of part.doc.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (/^(kindle:pos|filepos:)/i.test(href)) a.setAttribute("href", resolve(href) || "#");
    }
  }

  const navItem = (item) => ({
    label: item.label,
    href: resolve(item.href) || parts[0].file,
    children: item.children?.map(navItem),
  });

  return buildEpub({
    meta: {
      identifier: meta.identifier || "mobi",
      title: meta.title,
      creators: meta.author,
      language: meta.language,
    },
    parts,
    toc: toc.map(navItem),
  });
}

/**
 * Opens a MOBI or KF8 book: turned into an ePub, then shown as one. Saved
 * positions stay valid, since the same book always turns into the same ePub.
 *
 * @param {HTMLElement} viewer
 * @param {string | ArrayBuffer} input
 * @param {object} ctx
 */
export async function open(viewer, input, ctx) {
  const book = await parse(await bookBytes(input));
  let epub;
  try {
    epub = await toEpub(book);
  } catch (e) {
    book.destroy();
    throw e;
  }
  const session = openEpub(viewer, epub, ctx);
  // The ePub's rendition changes with the layout, so `raw` stays a getter
  const epubRaw = Object.getOwnPropertyDescriptor(session, "raw").get,
    destroyEpub = session.destroy;
  return Object.defineProperties(session, {
    raw: { get: () => ({ ...epubRaw.call(session), mobi: book }) },
    destroy: {
      value() {
        destroyEpub();
        book.destroy();
      },
    },
  });
}
