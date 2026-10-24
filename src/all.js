import { createEpubier } from "./core.js";
import epub from "./formats/epub/index.js";
import pdf from "./formats/pdf/index.js";
import cbz from "./formats/cbz/index.js";
import comicarchive from "./formats/comicarchive/index.js";
import mobi from "./formats/mobi/index.js";
import rtf from "./formats/rtf/index.js";

/**
 * Replaces `element` with a reader for the ePub, PDF, comic book (.cbz,
 * .cbr, .cb7), Kindle book (.mobi, .azw3) or RTF document at `path`, or whose
 * contents are `path` when it's an ArrayBuffer. PDF.js, libarchive, the Kindle
 * parser and rtf.js are loaded only once a book needs them.
 */
export default createEpubier([epub, pdf, cbz, comicarchive, mobi, rtf]);
