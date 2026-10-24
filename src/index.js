import { createEpubier } from "./core.js";
import epub from "./formats/epub/index.js";

/**
 * Replaces `element` with an ePub reader for the book at `path`, or for the
 * book whose contents are `path` when it's an ArrayBuffer. Reads ePubs only;
 * see all.js, or createEpubier() in core.js, for other formats.
 */
export default createEpubier([epub]);
