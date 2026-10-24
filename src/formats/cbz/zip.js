/**
 * Reads a zip a file at a time, from a Source (see ../source.js): the
 * central directory at its end lists where each file is, so a file is a
 * slice of the zip, inflated by the browser's DecompressionStream when it's
 * compressed. Only the files read are ever in memory, or downloaded, when
 * the zip is a URL on a server that takes range requests.
 */
import { bookError } from "../../strings.js";

const u16 = (view, at) => view.getUint16(at, true);
const u32 = (view, at) => view.getUint32(at, true);
const u64 = (view, at) => u32(view, at) + u32(view, at + 4) * 2 ** 32;

async function bytes(source, start, end) {
  const array = await source.bytes(start, end);
  return new DataView(array.buffer, array.byteOffset, array.byteLength);
}

/** The central directory's {count, size, offset}, from the end of central directory record */
async function directory(source) {
  // The record is 22 bytes, then a comment of up to 64kb
  const tailStart = Math.max(0, source.size - 22 - 0xffff);
  const tail = await bytes(source, tailStart, source.size);
  let at = tail.byteLength - 22;
  while (at >= 0 && u32(tail, at) !== 0x06054b50) at--;
  if (at < 0) throw bookError("notZip");
  const record = { count: u16(tail, at + 10), size: u32(tail, at + 12), offset: u32(tail, at + 16) };
  // Zip64: the real values are in another record, which a locator just before this one points to
  if (at >= 20 && u32(tail, at - 20) === 0x07064b50) {
    const zip64At = u64(tail, at - 20 + 8);
    const zip64 = await bytes(source, zip64At, zip64At + 56);
    if (u32(zip64, 0) === 0x06064b50) return { count: u64(zip64, 32), size: u64(zip64, 40), offset: u64(zip64, 48) };
  }
  return record;
}

/**
 * The files in the zip `source` has, with a way to read each.
 *
 * @param {import("../source.js").Source} source
 * @returns {Promise<Array<{name: string, read: () => Promise<Blob>}>>}
 */
export async function readZip(source) {
  const { count, size, offset } = await directory(source);
  const cd = await bytes(source, offset, offset + size);
  const utf8 = new TextDecoder();
  const files = [];
  for (let at = 0, n = 0; n < count && u32(cd, at) === 0x02014b50; n++) {
    const flags = u16(cd, at + 8),
      method = u16(cd, at + 10),
      nameLength = u16(cd, at + 28),
      extraLength = u16(cd, at + 30),
      commentLength = u16(cd, at + 32);
    let packed = u32(cd, at + 20),
      unpacked = u32(cd, at + 24),
      local = u32(cd, at + 42);
    const name = utf8.decode(new Uint8Array(cd.buffer, cd.byteOffset + at + 46, nameLength));
    // A zip64 extra field has the sizes and offset too big for their places, in this order
    for (let e = at + 46 + nameLength, end = e + extraLength; e + 4 <= end; e += 4 + u16(cd, e + 2)) {
      if (u16(cd, e) !== 1) continue;
      let field = e + 4;
      if (unpacked === 0xffffffff) (unpacked = u64(cd, field)), (field += 8);
      if (packed === 0xffffffff) (packed = u64(cd, field)), (field += 8);
      if (local === 0xffffffff) local = u64(cd, field);
    }
    at += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/")) continue;
    files.push({
      name,
      async read() {
        if (flags & 1) throw bookError("passwordProtected");
        const data = await fileData(source, local, packed, nameLength + extraLength);
        if (method === 0) return data;
        if (method === 8) return new Response(data.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
        throw bookError("unsupportedCompression", { name });
      },
    });
  }
  return files;
}

/**
 * The `packed` bytes of the file whose local header is at `local`. That
 * header's name and extra field can differ from the central directory's;
 * from a URL, they're read in one request with the data, guessing they're
 * about the same length, as they usually are.
 */
async function fileData(source, local, packed, guess) {
  if (source.ranged) {
    const chunk = await source.bytes(local, local + 30 + guess + 256 + packed);
    const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    const start = 30 + u16(view, 26) + u16(view, 28);
    if (start + packed <= chunk.length) return new Blob([chunk.subarray(start, start + packed)]);
    return source.slice(local + start, local + start + packed);
  }
  const header = await bytes(source, local, local + 30);
  const start = local + 30 + u16(header, 26) + u16(header, 28);
  return source.slice(start, start + packed);
}
