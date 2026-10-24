import { hasAscii, isRar } from "../sniff.js";

// The script epubier.all.min.js was loaded from, whose folder has the
// archive worker beside it. Only known while that script first runs.
const script = typeof document !== "undefined" ? document.currentScript?.src : undefined;
const bundledWorker = script && /\/epubier\.all\.min\.js(\?|$)/.test(script) ? new URL("comicarchive.worker.js", script).href : undefined;

/**
 * Comic books in RAR (.cbr) and 7-Zip (.cb7) archives, read by libarchive
 * in a worker, which is loaded only once one is opened. One that's really
 * a zip, as many .cbr files are, opens like a .cbz.
 */
export default {
  id: "comicarchive",
  extensions: ["cbr", "cb7"],
  test: (bytes) => isRar(bytes) || hasAscii(bytes, "7z\xbc\xaf\x27\x1c"),
  // Given a URL or a Blob, it reads just the parts it needs
  piecewise: true,
  load: () => import("./session.js").then((engine) => ({ open: (viewer, input, ctx) => engine.open(viewer, input, ctx, bundledWorker) })),
};
