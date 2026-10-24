import type { Epubier } from "../epubier.js";
export type * from "../epubier.js";

/**
 * Replaces `element` with a reader for the ePub, PDF, comic book (.cbz, .cbr, .cb7), Kindle book (.mobi, .azw3) or RTF document at
 * `path` (a URL), or whose contents are `path` when it's an `ArrayBuffer` or `Blob`.
 */
declare const epubier: Epubier;
export default epubier;
