// A worker that reads a comic's pages out of a RAR or 7z archive, one at a
// time, with libarchive (compiled to WebAssembly by libarchive.js), which
// finds its libarchive.wasm beside this script.
//
// The archive is copied into WebAssembly's memory once. libarchive reads an
// archive front to back, so a cursor is kept where the last page was read:
// the next page on is reached by skipping what's between (in a solid
// archive, by unpacking it, as there's no other way), and a page before it
// by starting again from the top. libarchive.js's own worker opens the
// archive afresh for each file and never closes it, which leaks the
// decompressor's window (often 4mb or more) a page.
//
// It can also unpack the one file in a small archive of its own, as the
// session makes for a page of a RAR archive it reads in pieces (rar.js),
// without the whole archive.
//
// Messages, each answered with {id, result} or {id, error}:
//   {id, type: "open", blob}   -> {entries: [{name, size, encrypted}]}, by
//                                 position in the archive (folders left out)
//   {id, type: "read", index}  -> the entry's bytes, an ArrayBuffer (transferred)
//   {id, type: "unpack", blob} -> the bytes of the first file in the archive `blob`
// An error is {message, code, vars}, with the code and vars of bookError()'s
import { getWasmModule } from "libarchive.js/src/webworker/wasm-module.js";
import { bookError } from "../../strings.js";

/** archive_entry_filetype for a regular file. Some 7z writers give none (0). */
const FILE = 0o100000;

const ready = new Promise((resolve) => getWasmModule(resolve));
let wasm, run;
/** The archive's bytes in WebAssembly's memory */
let buffer = 0,
  length = 0;
/** libarchive's reader, and the position of the entry it last read (-1 before the first) */
let archive = 0,
  position = -1;

function close() {
  if (archive) run.closeArchive(archive);
  archive = 0;
  position = -1;
}

function rewind() {
  close();
  archive = run.openArchive(buffer, length, null, "en_US.UTF-8");
  if (!archive) throw bookError("archiveUnreadable");
}

/** The next entry, or 0 at the end */
function next() {
  const entry = run.getNextEntry(archive);
  if (entry) position++;
  else {
    const error = run.getError(archive);
    if (error) throw new Error(error);
  }
  return entry;
}

/** Copies `blob` into WebAssembly's memory, a piece at a time, so it's never held twice */
async function copyIn(blob) {
  const ptr = run.malloc(blob.size);
  if (!ptr) throw bookError("tooBig");
  let offset = 0;
  const reader = blob.stream().getReader();
  for (let chunk; !(chunk = await reader.read()).done; offset += chunk.value.length) {
    wasm.HEAPU8.set(chunk.value, ptr + offset);
  }
  return ptr;
}

async function load(blob) {
  close();
  if (buffer) run.free(buffer);
  buffer = 0;
  buffer = await copyIn(blob);
  length = blob.size;
}

/** The entry `archive` is at, read whole */
function data(archive, entry) {
  const size = run.getEntrySize(entry);
  const ptr = run.getFileData(archive, size);
  if (ptr < 0) throw run.getError(archive) ? new Error(run.getError(archive)) : bookError("pageUnpackFailed");
  const bytes = wasm.HEAPU8.slice(ptr, ptr + size);
  wasm._free(ptr);
  return bytes.buffer;
}

async function unpack(blob) {
  const ptr = await copyIn(blob);
  const single = run.openArchive(ptr, blob.size, null, "en_US.UTF-8");
  try {
    if (!single) throw bookError("pageUnpackFailed");
    const entry = run.getNextEntry(single);
    if (!entry) throw run.getError(single) ? new Error(run.getError(single)) : bookError("pageUnpackFailed");
    return data(single, entry);
  } finally {
    if (single) run.closeArchive(single);
    run.free(ptr);
  }
}

function list() {
  rewind();
  const entries = [];
  for (let entry; (entry = next()); ) {
    const type = run.getEntryType(entry);
    if (type === FILE || type === 0) {
      entries.push({
        index: position,
        name: run.getEntryName(entry),
        size: run.getEntrySize(entry),
        encrypted: run.entryIsEncrypted(entry) > 0,
      });
    }
    run.skipEntry(archive);
  }
  close();
  return entries;
}

function read(index) {
  if (!archive || index <= position) rewind();
  let entry;
  while (position < index) {
    entry = next();
    if (!entry) throw bookError("pageMissing");
    if (position < index) run.skipEntry(archive);
  }
  return data(archive, entry);
}

// One message at a time, as each moves the cursor
let queue = ready.then((module) => {
  wasm = module;
  run = module.runCode;
});
self.onmessage = ({ data: { id, type, blob, index } }) => {
  queue = queue.then(async () => {
    try {
      if (type === "open") {
        await load(blob);
        self.postMessage({ id, result: { entries: list() } });
      } else {
        const bytes = type === "unpack" ? await unpack(blob) : read(index);
        self.postMessage({ id, result: bytes }, [bytes]);
      }
    } catch (e) {
      self.postMessage({ id, error: { message: String(e?.message || e), code: e?.code, vars: e?.vars } });
    }
  });
};
