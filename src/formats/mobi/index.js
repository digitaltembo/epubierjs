import { hasAscii } from "../sniff.js";

/**
 * Kindle books: MOBI and KF8 (.azw3), which are turned into an ePub to
 * read. The parser and epub.js are loaded only once one is opened.
 */
export default {
  id: "mobi",
  extensions: ["mobi", "azw3", "azw"],
  // A Palm database whose type and creator are BOOK and MOBI
  test: (bytes) => hasAscii(bytes, "BOOKMOBI", 60),
  load: () => import("./session.js"),
};
