/**
 * Reads where each file is in a RAR archive, from its headers, so a page
 * can be read without the rest: RARLAB publishes the archive format (if not
 * its compression). Each file's header sits just before its data, so
 * finding them all means hopping from one to the next, a read each; a RAR 5
 * archive can instead have a copy of them near its end (the "quick open"
 * record), which is read in one go when it's there. WinRAR copies only
 * larger files' headers there by default; the others, between them, are
 * read where they are, which small files keep close together.
 *
 * A file that's stored, as comic pages often are (they're already
 * compressed images), is just its data. A compressed one, in an archive
 * that isn't solid, unpacks on its own: it's put in an archive by itself
 * for libarchive to unpack.
 */
import { bookError } from "../../strings.js";

const RAR4 = [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00];
const RAR5 = [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00];
/** How much to read at a time when hopping between headers, so small files' headers come together */
const CHUNK = 16 * 1024;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A RAR 5 variable-length integer at `at`: [value, the position after it] */
function vint(bytes, at) {
  let value = 0;
  for (let shift = 1; at < bytes.length; shift *= 128) {
    const byte = bytes[at++];
    value += (byte & 0x7f) * shift;
    if (!(byte & 0x80)) return [value, at];
  }
  throw bookError("archiveCutShort");
}
function vintBytes(value) {
  const out = [];
  do {
    const low = value % 128;
    value = Math.floor(value / 128);
    out.push(value ? low | 0x80 : low);
  } while (value);
  return out;
}

const u16 = (bytes, at) => bytes[at] | (bytes[at + 1] << 8);
const u32 = (bytes, at) => (u16(bytes, at) | (u16(bytes, at + 2) << 16)) >>> 0;

/** Reads `source` a chunk at a time, keeping the last chunk read */
function reader(source) {
  let start = 0,
    chunk = new Uint8Array(0);
  return async (at, length) => {
    if (at < start || at + length > start + chunk.length) {
      start = at;
      chunk = await source.bytes(at, at + Math.max(length, CHUNK));
    }
    if (at + length > start + chunk.length) throw bookError("archiveCutShort");
    return chunk.subarray(at - start, at - start + length);
  };
}

// --- RAR 5 ------------------------------------------------------------------

/** A RAR 5 header block in `bytes` (from its CRC on), with where its data is, given it's at `pos` */
function block5(bytes, pos) {
  const [size, body] = vint(bytes, 4);
  const length = body + size;
  let [type, at] = vint(bytes, body);
  let flags, extraSize = 0, dataSize = 0;
  [flags, at] = vint(bytes, at);
  if (flags & 1) [extraSize, at] = vint(bytes, at);
  if (flags & 2) [dataSize, at] = vint(bytes, at);
  return { pos, length, bytes: bytes.subarray(0, length), type, flags, fields: at, extra: length - extraSize, dataSize };
}

async function readBlock5(read, pos) {
  // Its CRC, then its size, a vint of up to 3 bytes
  const start = await read(pos, 7);
  const [size, body] = vint(start, 4);
  return block5(await read(pos, body + size), pos);
}

/** The extra area's records, as [type, the position of its fields] */
function* records5(block) {
  for (let at = block.extra; at < block.length; ) {
    const [size, start] = vint(block.bytes, at);
    yield vint(block.bytes, start);
    at = start + size;
  }
}

/** A file (or service) header's entry */
function file5(block) {
  const b = block.bytes;
  let [flags, at] = vint(b, block.fields);
  let compression, nameLength;
  at = vint(b, at)[1]; // unpacked size
  at = vint(b, at)[1]; // attributes
  if (flags & 2) at += 4; // modification time
  if (flags & 4) at += 4; // CRC32
  [compression, at] = vint(b, at);
  at = vint(b, at)[1]; // host OS
  [nameLength, at] = vint(b, at);
  return {
    name: new TextDecoder().decode(b.subarray(at, at + nameLength)),
    directory: !!(flags & 1),
    encrypted: [...records5(block)].some(([type]) => type === 1),
    stored: ((compression >> 7) & 7) === 0,
    solid: !!(compression & 0x40),
    // Continued from or in another volume
    split: !!(block.flags & 0x18),
    dataStart: block.pos + block.length,
    packed: block.dataSize,
    header: block.bytes,
  };
}

/**
 * The headers from `mainEnd` to the quick open record at `qoPos`: those
 * copied into it, and the ones between them, read where they are. Null if
 * they don't fit together.
 */
async function quickOpen5(source, read, mainEnd, qoPos) {
  const qo = await readBlock5(read, qoPos);
  if (qo.type !== 3 || file5(qo).name !== "QO") return null;
  const data = await source.bytes(qoPos + qo.length, qoPos + qo.length + qo.dataSize);
  const blocks = [];
  for (let at = 0; at + 4 < data.length; ) {
    const [size, start] = vint(data, at + 4);
    let [, field] = vint(data, start); // flags
    let offset, length;
    [offset, field] = vint(data, field);
    [length, field] = vint(data, field);
    blocks.push(block5(data.slice(field, field + length), qoPos - offset));
    at = start + size;
  }
  const all = [];
  let pos = mainEnd;
  for (const next of [...blocks, null]) {
    const until = next ? next.pos : qoPos;
    while (pos < until) {
      const block = await readBlock5(read, pos);
      all.push(block);
      pos += block.length + block.dataSize;
    }
    if (pos !== until) return null;
    if (next) {
      all.push(next);
      pos += next.length + next.dataSize;
    }
  }
  return all;
}

async function headers5(source) {
  const read = reader(source);
  const main = await readBlock5(read, RAR5.length);
  if (main.type !== 1) return null;
  const archiveFlags = vint(main.bytes, main.fields)[0];
  // Volumes of a multi-part archive
  if (archiveFlags & 1) return null;
  const mainEnd = main.pos + main.length;

  let blocks = null;
  for (const [type, at] of records5(main)) {
    if (type !== 1) continue;
    const [flags, offsetAt] = vint(main.bytes, at);
    const offset = flags & 1 ? vint(main.bytes, offsetAt)[0] : 0;
    if (offset) blocks = await quickOpen5(source, read, mainEnd, main.pos + offset).catch(() => null);
  }
  if (!blocks) {
    blocks = [];
    for (let pos = mainEnd; pos < source.size; ) {
      const block = await readBlock5(read, pos);
      // Encrypted headers can't be read without the password
      if (block.type === 4) return null;
      if (block.type === 5) break;
      blocks.push(block);
      pos += block.length + block.dataSize;
    }
  }
  return { solid: !!(archiveFlags & 4), entries: blocks.filter((b) => b.type === 2).map(file5) };
}

function header5(fields) {
  const sized = new Uint8Array([...vintBytes(fields.length), ...fields]);
  const crc = crc32(sized);
  return new Uint8Array([crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff, crc >>> 24, ...sized]);
}

// --- RAR 4 ------------------------------------------------------------------

/**
 * A RAR 4 file name: its own bytes (in the system's code page, taken as
 * UTF-8, or Windows-1252 where it isn't), or with the Unicode flag, those
 * then a 0 and its UTF-16 compressed against them (unrar's DecodeFileName)
 */
function name4(bytes, unicode) {
  const zero = bytes.indexOf(0);
  if (!unicode || zero < 0) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("windows-1252").decode(bytes);
    }
  }
  const plain = bytes.subarray(0, zero),
    encoded = bytes.subarray(zero + 1);
  const out = [];
  const high = encoded[0];
  let at = 1,
    flags = 0,
    flagBits = 0;
  while (at < encoded.length) {
    if (!flagBits) (flags = encoded[at++]), (flagBits = 8);
    switch (flags >> 6) {
      case 0:
        out.push(encoded[at++]);
        break;
      case 1:
        out.push(encoded[at++] + (high << 8));
        break;
      case 2:
        out.push(encoded[at] + (encoded[at + 1] << 8));
        at += 2;
        break;
      default: {
        let length = encoded[at++];
        const correction = length & 0x80 ? encoded[at++] : null;
        for (length = (length & 0x7f) + 2; length > 0 && out.length < plain.length; length--) {
          const byte = plain[out.length];
          out.push(correction === null ? byte : ((byte + correction) & 0xff) + (high << 8));
        }
      }
    }
    flags = (flags << 2) & 0xff;
    flagBits -= 2;
  }
  return String.fromCharCode(...out);
}

async function headers4(source) {
  const read = reader(source);
  const entries = [];
  let solid = false;
  for (let pos = RAR4.length; pos < source.size; ) {
    const head = await read(pos, 7);
    const type = head[2],
      flags = u16(head, 3),
      size = u16(head, 5);
    const block = await read(pos, size);
    let dataSize = flags & 0x8000 ? u32(block, 7) : 0;
    if (type === 0x73) {
      // Multi-part, or with encrypted headers
      if (flags & 0x0081) return null;
      solid = !!(flags & 0x0008);
    } else if (type === 0x74) {
      if (flags & 0x0100) dataSize += u32(block, 32) * 2 ** 32;
      const nameAt = flags & 0x0100 ? 40 : 32;
      entries.push({
        name: name4(block.subarray(nameAt, nameAt + u16(block, 26)), flags & 0x0200).replaceAll("\\", "/"),
        directory: (flags & 0xe0) === 0xe0,
        encrypted: !!(flags & 0x0004),
        stored: block[25] === 0x30,
        solid: !!(flags & 0x0010),
        split: !!(flags & 0x0003),
        dataStart: pos + size,
        packed: dataSize,
        header: block.slice(),
      });
    } else if (type === 0x7b) break;
    pos += size + dataSize;
  }
  return { solid, entries };
}

function header4(type, flags, rest) {
  const fields = new Uint8Array([type, flags & 0xff, flags >> 8, (7 + rest.length) & 0xff, (7 + rest.length) >> 8, ...rest]);
  const crc = crc32(fields);
  return new Uint8Array([crc & 0xff, (crc >>> 8) & 0xff, ...fields]);
}

// ----------------------------------------------------------------------------

/**
 * Where each file in the RAR archive `source` has is, or null when that
 * can't be relied on: the headers are encrypted, or it's one part of
 * several. Files in a solid archive can only be unpacked in order, so
 * `solid` says to unpack it whole instead.
 *
 * @param {import("../source.js").Source} source
 * @returns {Promise<{version: 4 | 5, solid: boolean, entries: Array<{
 *   name: string, directory: boolean, encrypted: boolean, stored: boolean,
 *   solid: boolean, split: boolean, dataStart: number, packed: number, header: Uint8Array,
 * }>} | null>}
 */
export async function readRar(source) {
  const signature = await source.bytes(0, 8);
  const is = (expected) => expected.every((byte, i) => signature[i] === byte);
  const archive = is(RAR5) ? { version: 5, ...(await headers5(source)) } : is(RAR4) ? { version: 4, ...(await headers4(source)) } : null;
  if (!archive?.entries) return null;
  if (archive.entries.some((entry) => entry.solid)) archive.solid = true;
  return archive;
}

/** An archive of just `entry` (from `archive`), with its packed `data`, for libarchive to unpack */
export function singleFileRar(archive, entry, data) {
  const parts =
    archive.version === 5
      ? [new Uint8Array(RAR5), header5([1, 0, 0]), entry.header, data, header5([5, 0, 0])]
      : [new Uint8Array(RAR4), header4(0x73, 0, [0, 0, 0, 0, 0, 0]), entry.header, data, header4(0x7b, 0x4000, [])];
  return new Blob(parts);
}
