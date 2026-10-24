import { hasAscii } from "../sniff.js";

/**
 * Rich Text Format documents, which are turned into an ePub to read.
 * rtf.js and epub.js are loaded only once one is opened.
 */
export default {
  id: "rtf",
  extensions: ["rtf"],
  test: (bytes) => hasAscii(bytes, "{\\rtf"),
  load: () => import("./session.js"),
};
