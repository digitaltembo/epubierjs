/** Whether `bytes` holds `text` (ASCII) at `offset` */
export function hasAscii(bytes, text, offset = 0) {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

export const isZip = (bytes) => hasAscii(bytes, "PK\x03\x04");

/**
 * Whether a zip is an ePub. The spec has its first file be `mimetype`,
 * uncompressed, so its name and contents sit at a fixed offset.
 */
export const isEpub = (bytes) => isZip(bytes) && hasAscii(bytes, "mimetypeapplication/epub+zip", 30);
