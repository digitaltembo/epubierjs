import { bookError } from "../strings.js";

/**
 * A book's bytes, read a piece at a time: from a Blob (which, unlike an
 * ArrayBuffer, the browser can keep on disk when it's large), or from a URL
 * with HTTP range requests, so only the pieces read are downloaded. A
 * server that doesn't take range requests sends the whole book, which is
 * kept as a Blob. `ranged` says which: whether each read is a request.
 *
 * @typedef {{
 *   size: number,
 *   ranged: boolean,
 *   bytes: (start: number, end: number) => Promise<Uint8Array>,
 *   slice: (start: number, end: number) => Promise<Blob>,
 *   blob: () => Promise<Blob>,
 *   close: () => void,
 * }} Source
 */

/** How much of a URL the first request asks for, which later reads within it come from */
const HEAD = 64 * 1024;

/** @returns {Source} */
export function blobSource(blob) {
  return {
    size: blob.size,
    ranged: false,
    bytes: async (start, end) => new Uint8Array(await blob.slice(start, end).arrayBuffer()),
    slice: async (start, end) => blob.slice(start, end),
    blob: async () => blob,
    close() {},
  };
}

/**
 * The bytes of `input`: a URL, an ArrayBuffer or a Blob.
 *
 * @returns {Promise<Source>}
 */
export async function openSource(input) {
  if (typeof input !== "string") return blobSource(input instanceof Blob ? input : new Blob([input]));

  // Closing the book stops what's still downloading
  const controller = new AbortController();
  const { signal } = controller;
  const response = await fetch(input, { headers: { Range: `bytes=0-${HEAD - 1}` }, signal });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  // A cross-origin server has to expose Content-Range for its size to be known
  const size = response.status === 206 && Number(/\/(\d+)$/.exec(response.headers.get("Content-Range") || "")?.[1]);
  if (!size) {
    if (response.status !== 206) return blobSource(await response.blob());
    response.body?.cancel();
    return blobSource(await whole(input, signal));
  }

  const head = new Uint8Array(await response.arrayBuffer());
  // Pieces read later have to come from the same version of the book
  const validator = response.headers.get("ETag") || response.headers.get("Last-Modified");
  let full;
  return {
    size,
    ranged: true,
    async bytes(start, end) {
      end = Math.min(end, size);
      if (start >= end) return new Uint8Array(0);
      if (end <= head.length) return head.slice(start, end);
      const headers = { Range: `bytes=${start}-${end - 1}` };
      if (validator) headers["If-Range"] = validator;
      const part = await fetch(input, { headers, signal });
      if (part.status !== 206) {
        part.body?.cancel();
        throw part.ok ? bookError("changedOnServer") : new Error(`${part.status} ${part.statusText}`);
      }
      return new Uint8Array(await part.arrayBuffer());
    },
    async slice(start, end) {
      return new Blob([await this.bytes(start, end)]);
    },
    blob: () => (full ||= whole(input, signal)),
    close: () => controller.abort(),
  };
}

async function whole(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.blob();
}
