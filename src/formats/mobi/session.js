import { initKf8File, initMobiFile } from "@lingo-reader/mobi-parser";
// The same JSZip build epub.js uses, so there's one copy
import JSZip from "jszip/dist/jszip";
import { open as openEpub } from "../epub/session.js";
import { bookBytes } from "../fetch.js";

const escapeXml = (text) =>
  String(text).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

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
  const doc = new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${html}</body></html>`, "text/html");
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

  const navItems = (items) =>
    `<ol>${items
      .map(
        (item) =>
          `<li><a href="${escapeXml(resolve(item.href) || parts[0].file)}">${escapeXml(item.label || "")}</a>${
            item.children?.length ? navItems(item.children) : ""
          }</li>`,
      )
      .join("")}</ol>`;

  const serializer = new XMLSerializer();
  const zip = new JSZip();
  // The spec has `mimetype` first, uncompressed
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );
  for (const part of parts) {
    const { doc } = part;
    const title = doc.createElement("title");
    title.textContent = meta.title || "";
    doc.head.append(title);
    for (const href of part.css) {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.type = "text/css";
      link.href = href;
      doc.head.append(link);
    }
    zip.file(`OEBPS/${part.file}`, `<?xml version="1.0" encoding="utf-8"?>\n${serializer.serializeToString(doc.documentElement)}`);
  }
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head>
<body><nav epub:type="toc">${navItems(toc)}</nav></body>
</html>`,
  );
  const creators = (meta.author || []).map((name) => `<dc:creator>${escapeXml(name)}</dc:creator>`).join("");
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">${escapeXml(meta.identifier || "mobi")}</dc:identifier>
    <dc:title>${escapeXml(meta.title || "")}</dc:title>
    ${creators}
    <dc:language>${escapeXml(meta.language || "en")}</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${parts.map((p, i) => `<item id="p${i}" href="${p.file}" media-type="application/xhtml+xml"/>`).join("\n    ")}
  </manifest>
  <spine>
    ${parts.map((p, i) => `<itemref idref="p${i}"/>`).join("\n    ")}
  </spine>
</package>`,
  );
  return zip.generateAsync({ type: "arraybuffer", compression: "STORE" });
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
