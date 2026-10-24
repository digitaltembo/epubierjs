// Fixes to epub.js, applied to its classes when epubier loads. They patch the
// same modules session.js loads epub.js from (its src/).
import Archive from "epubjs/src/archive.js";
import Resources from "epubjs/src/resources.js";
import mime from "epubjs/src/utils/mime.js";
import Path from "epubjs/src/utils/path.js";
import { substitute } from "epubjs/src/utils/replacements.js";

const createCssFile = Resources.prototype.createCssFile;

/**
 * With `replacements: "base64"`, epub.js encodes each stylesheet with btoa,
 * which throws on any character outside Latin-1 (curly quotes in a comment,
 * say), and the book never opens. A percent-encoded data URL takes any text.
 */
Resources.prototype.createCssFile = function (href) {
  if (this.settings.replacements !== "base64" || !this.settings.archive || href.startsWith("/")) {
    return createCssFile.call(this, href);
  }
  const absolute = this.settings.resolver(href);
  const text = this.settings.archive.getText(absolute);
  if (!text) return Promise.resolve();
  // Asset links, relative to the stylesheet, so they match how it refers to them.
  const relUrls = this.urls.map((assetHref) => new Path(absolute).relative(this.settings.resolver(assetHref)));
  return text.then(
    (css) => "data:text/css;charset=utf-8," + encodeURIComponent(substitute(css, relUrls, this.replacementUrls)),
    () => undefined,
  );
};

/** Base64 of some bytes: native where the browser has it, which is far faster than JSZip's own encoder. */
function toBase64(bytes) {
  if (bytes.toBase64) return bytes.toBase64();
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * The data URL for a file in the book, for `replacements: "base64"`. epub.js
 * has JSZip encode it, which for a book full of images took most of the time
 * it took to open.
 */
Archive.prototype.getBase64 = function (url, mimeType) {
  const entry = this.zip.file(window.decodeURIComponent(url.substr(1))); // Without the leading slash
  if (!entry) return undefined;
  const type = mimeType || mime.lookup(entry.name);
  return entry.async("uint8array").then((bytes) => "data:" + type + ";base64," + toBase64(bytes));
};
