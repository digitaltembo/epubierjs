// The same JSZip build epub.js uses, so there's one copy
import JSZip from "jszip/dist/jszip";

export const escapeXml = (text) =>
  String(text).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

/** An HTML fragment as a document, to fill and then put in an ePub with buildEpub() */
export function htmlDocument(html = "") {
  return new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${html}</body></html>`, "text/html");
}

/**
 * An ePub, for formats that are read by turning them into one. Each part's
 * document is serialized as XHTML, with the book's title and the part's
 * stylesheets; `toc` entries' hrefs are part files, with an #id or not.
 *
 * @param {{
 *   meta: {identifier: string, title?: string, creators?: string[], language?: string},
 *   parts: Array<{file: string, doc: Document, css?: string[]}>,
 *   toc: Array<{label: string, href: string, children?: Array<object>}>,
 * }} book
 * @returns {Promise<ArrayBuffer>}
 */
export function buildEpub({ meta, parts, toc }) {
  const navItems = (items) =>
    `<ol>${items
      .map(
        (item) =>
          `<li><a href="${escapeXml(item.href)}">${escapeXml(item.label || "")}</a>${
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
    for (const href of part.css || []) {
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
  const creators = (meta.creators || []).map((name) => `<dc:creator>${escapeXml(name)}</dc:creator>`).join("");
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">${escapeXml(meta.identifier)}</dc:identifier>
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
