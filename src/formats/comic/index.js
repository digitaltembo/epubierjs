import { isEpub, isZip } from "../sniff.js";

/** Comic books in zip archives (.cbz): a page per image, in file name order */
export default {
  id: "comic",
  extensions: ["cbz"],
  test: (bytes) => isZip(bytes) && !isEpub(bytes),
  load: () => import("./session.js"),
};
