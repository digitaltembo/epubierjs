import * as pdfjs from "pdfjs-dist";
import { pagedSession } from "../paged.js";

/** The most pixels a page's canvas has */
const MAX_CANVAS_PIXELS = 16777216;

/** PDF.js's files, from the CDN, matching the PDF.js in use */
const cdn = () => `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/`;

/** The 1-based page a PDF destination (named or explicit) points to, or null */
async function destinationPage(pdf, dest) {
  try {
    if (typeof dest === "string") dest = await pdf.getDestination(dest);
    if (!Array.isArray(dest)) return null;
    const ref = dest[0];
    return (typeof ref === "object" ? await pdf.getPageIndex(ref) : ref) + 1;
  } catch (e) {
    return null;
  }
}

/** A PDF's outline as table of contents items */
function outlineItems(pdf, items) {
  return Promise.all(
    (items || []).map(async (item) => {
      const page = await destinationPage(pdf, item.dest);
      return {
        label: item.title,
        target: page ? String(page) : null,
        index: page ?? -1,
        subitems: await outlineItems(pdf, item.items),
      };
    }),
  );
}

/**
 * Opens a PDF, its pages drawn by PDF.js into canvases.
 *
 * PDF.js needs its worker script, and fetches a few more files for some
 * PDFs (character maps, the standard fonts, image decoders). They come from
 * `opts.pdf.workerSrc` and `opts.pdf.assetsUrl` (a copy of pdfjs-dist's
 * folder), else PDF.js's own setting for the worker, else beside
 * epubier.all.min.js for the worker, else the CDN.
 *
 * @param {HTMLElement} viewer
 * @param {string | ArrayBuffer} input
 * @param {{opts: object, flow?: "paginated" | "scrolled"}} ctx
 * @param {string} [bundledWorker]
 */
export async function open(viewer, input, { opts, flow }, bundledWorker) {
  const settings = opts.pdf || {};
  if (settings.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = settings.workerSrc;
  else if (!pdfjs.GlobalWorkerOptions.workerSrc && !pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerSrc = bundledWorker || `${cdn()}build/pdf.worker.min.mjs`;
  }
  const assets = settings.assetsUrl ? settings.assetsUrl.replace(/\/?$/, "/") : cdn();

  const task = pdfjs.getDocument({
    // PDF.js takes over (detaches) the buffer it's given; keep the caller's
    ...(typeof input === "string" ? { url: input } : { data: new Uint8Array(input.slice(0)) }),
    cMapUrl: `${assets}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`,
  });
  const pdf = await task.promise;
  const first = (await pdf.getPage(1)).getViewport({ scale: 1 });

  return pagedSession(
    viewer,
    {
      count: pdf.numPages,
      // Pages are assumed to share the first one's shape
      aspect: first.width / first.height,
      raw: { pdf },
      metadata: pdf.getMetadata().then(
        ({ info }) => ({ title: info?.Title, creator: info?.Author }),
        () => ({}),
      ),
      toc: pdf.getOutline().then(
        (outline) => outlineItems(pdf, outline),
        () => [],
      ),

      render(index, slot, size) {
        const canvas = document.createElement("canvas");
        slot.append(canvas);
        let rendering = null,
          cancelled = false;
        pdf
          .getPage(index + 1)
          .then((page) => {
            if (cancelled) return;
            const natural = page.getViewport({ scale: 1 });
            // Sharp on high-density screens, but not past what browsers will
            // draw in one canvas (Safari's limit), as a page zoomed in could be
            const ratio = Math.min(
              window.devicePixelRatio || 1,
              Math.sqrt(MAX_CANVAS_PIXELS / (size.width * size.height)),
            );
            const viewport = page.getViewport({
              scale: Math.min(size.width / natural.width, size.height / natural.height) * ratio,
            });
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            rendering = page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport });
            return rendering.promise;
          })
          .catch((error) => {
            if (error?.name !== "RenderingCancelledException") console.error(error);
          });
        return {
          cancel() {
            cancelled = true;
            rendering?.cancel();
          },
        };
      },

      async *search(query) {
        const q = query.toLowerCase();
        for (let i = 1; i <= pdf.numPages; i++) {
          const content = await (await pdf.getPage(i)).getTextContent();
          const text = content.items
            .map((item) => (item.str || "") + (item.hasEOL ? " " : ""))
            .join("")
            .replace(/\s+/g, " ");
          const lower = text.toLowerCase(),
            results = [];
          for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, at + q.length)) {
            const start = Math.max(0, at - 60),
              end = Math.min(text.length, at + q.length + 60);
            const excerpt = (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
            results.push({ location: String(i), excerpt, index: i });
          }
          yield { done: i, total: pdf.numPages, results };
        }
      },

      destroy() {
        task.destroy();
      },
    },
    flow,
  );
}
