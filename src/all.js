import { createEpubier } from "./core.js";
import epub from "./formats/epub/index.js";
import pdf from "./formats/pdf/index.js";
import comic from "./formats/comic/index.js";
import mobi from "./formats/mobi/index.js";

/**
 * Replaces `element` with a reader for the ePub, PDF, comic book (.cbz) or
 * Kindle book (.mobi, .azw3) at `path`, or whose contents are `path` when
 * it's an ArrayBuffer. PDF.js and the Kindle parser are loaded only once a
 * book needs them.
 */
export default createEpubier([epub, pdf, comic, mobi]);
