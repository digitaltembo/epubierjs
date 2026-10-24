import type { Epubier } from "../epubier.js";
export type * from "../epubier.js";

/**
 * Replaces `element` with a reader for the ePub, PDF, comic book (.cbz) or Kindle book (.mobi, .azw3) at
 * `path` (a URL), or whose contents are `path` when it's an `ArrayBuffer`.
 */
declare const epubier: Epubier;
export default epubier;
