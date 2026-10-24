import { RTFJS, WMFJS, EMFJS } from "rtf.js";
import { open as openEpub } from "../epub/session.js";
import { buildEpub, htmlDocument } from "../epub/build.js";
import { bookBytes } from "../fetch.js";

RTFJS.loggingEnabled(false);
WMFJS.loggingEnabled(false);
EMFJS.loggingEnabled(false);

/**
 * rtf.js sizes text in points, on every run of it. As rems (12pt being the
 * browser's usual 16px), it follows the text size setting.
 */
function relativeSizes(root) {
  for (const el of root.querySelectorAll("[style*='font-size']")) {
    const points = /^([\d.]+)pt$/.exec(el.style.fontSize)?.[1];
    if (points) el.style.fontSize = `${Number(points) / 12}rem`;
  }
}

/**
 * The document as an ePub of one chapter, so it reads like one. Pictures
 * are data URLs (or SVG, for Windows metafiles), so the ePub holds them.
 */
async function toEpub(bytes) {
  const rtf = new RTFJS.Document(bytes, {});
  const elements = await rtf.render();
  const meta = rtf.metadata();
  const doc = htmlDocument();
  doc.body.append(...elements.map((el) => doc.adoptNode(el)));
  relativeSizes(doc.body);
  return buildEpub({
    meta: {
      identifier: "rtf",
      title: meta.title,
      creators: meta.author ? [meta.author] : [],
      language: "und",
    },
    parts: [{ file: "document.xhtml", doc }],
    toc: [],
  });
}

/**
 * Opens an RTF document: turned into an ePub, then shown as one. Saved
 * positions stay valid, since the same document always turns into the same
 * ePub.
 *
 * @param {HTMLElement} viewer
 * @param {string | ArrayBuffer} input
 * @param {object} ctx
 */
export async function open(viewer, input, ctx) {
  return openEpub(viewer, await toEpub(await bookBytes(input)), ctx);
}
