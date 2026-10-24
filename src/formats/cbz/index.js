import { isEpub, isZip } from "../sniff.js";

/** Comic books in zip archives (.cbz): a page per image, in file name order */
export default {
  id: "cbz",
  // Its books' saved data is kept under the id it had before 0.3.0
  storageId: "comic",
  extensions: ["cbz"],
  test: (bytes) => isZip(bytes) && !isEpub(bytes),
  // Given a URL or a Blob, it reads just the parts it needs
  piecewise: true,
  load: () => import("./session.js"),
};
