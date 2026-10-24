import { hasAscii } from "../sniff.js";

// The script epubier.all.min.js was loaded from, whose folder has the PDF.js
// worker beside it. Only known while that script first runs.
const script = typeof document !== "undefined" ? document.currentScript?.src : undefined;
const bundledWorker = script && /\/epubier\.all\.min\.js(\?|$)/.test(script) ? new URL("pdf.worker.min.mjs", script).href : undefined;

/** PDFs, through PDF.js, which is loaded only once one is opened */
export default {
  id: "pdf",
  extensions: ["pdf"],
  // Readers accept the header anywhere in the first kilobyte
  test: (bytes) => bytes.some((_, i) => hasAscii(bytes, "%PDF-", i)),
  load: () => import("./session.js").then((engine) => ({ open: (viewer, input, ctx) => engine.open(viewer, input, ctx, bundledWorker) })),
};
