import { isEpub } from "../sniff.js";
import { open } from "./session.js";

/**
 * ePubs, through epub.js. Loaded up front rather than on demand, so that
 * `epubier()` can hand back the book and rendition straight away.
 */
export default {
  id: "epub",
  extensions: ["epub"],
  test: isEpub,
  open,
};
