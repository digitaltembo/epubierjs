import { comicSession, openZip } from "../cbz/session.js";
import { openSource } from "../source.js";
import { isZip } from "../sniff.js";
import { readRar, singleFileRar } from "./rar.js";
import { bookError } from "../../strings.js";

/** The worker, from the CDN, in this version of epubier */
const cdnWorker = () => `https://cdn.jsdelivr.net/npm/epubier@${EPUBIER_VERSION}/dist/comicarchive.worker.js`;

/**
 * Starts the archive worker (worker.js) at `url`. It's started from a module
 * that imports it, which lets it be on another origin.
 */
function startWorker(url) {
  const loader = URL.createObjectURL(new Blob([`import ${JSON.stringify(url)};`], { type: "text/javascript" }));
  const worker = new Worker(loader, { type: "module" });
  const pending = new Map();
  let lastId = 0,
    failure = null;
  const fail = (error) => {
    failure = error;
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  };
  worker.addEventListener("message", ({ data: { id, result, error } }) => {
    const call = pending.get(id);
    pending.delete(id);
    if (error) call?.reject(Object.assign(new Error(error.message), { code: error.code, vars: error.vars }));
    else call?.resolve(result);
  });
  // A module that fails to load errors with no message
  worker.addEventListener("error", (event) => {
    event.preventDefault();
    fail(event.message ? new Error(event.message) : bookError("workerFailed", { url }));
  });
  return {
    call(message, transfer) {
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => {
        const id = ++lastId;
        pending.set(id, { resolve, reject });
        worker.postMessage({ ...message, id }, transfer || []);
      });
    },
    close() {
      worker.terminate();
      URL.revokeObjectURL(loader);
      fail(bookError("closed"));
    },
  };
}

/**
 * A RAR archive that isn't solid, read a page at a time from `source`
 * (rar.js): a stored page is just its bytes, and a compressed one is
 * unpacked by the worker on its own. From a URL, only the pages read are
 * downloaded, and the worker only starts if one is compressed.
 */
function piecewise(source, rar, worker) {
  const files = rar.entries.filter((entry) => !entry.directory);
  if (files.some((entry) => entry.encrypted)) throw bookError("passwordProtected");
  const byName = new Map(files.map((entry) => [entry.name, entry]));
  return {
    names: [...byName.keys()],
    async read(name) {
      const { dataStart, packed, stored } = byName.get(name);
      if (stored) return source.slice(dataStart, dataStart + packed);
      const data = await source.bytes(dataStart, dataStart + packed);
      return new Blob([await worker().call({ type: "unpack", blob: singleFileRar(rar, byName.get(name), data) })]);
    },
    raw: { entries: files },
  };
}

/**
 * Any other archive, held by the worker whole: it unpacks a page when it's
 * asked for, carrying on from the last one, which a solid archive needs.
 */
async function whole(source, worker) {
  const { entries } = await worker.call({ type: "open", blob: await source.blob() });
  if (entries.some((entry) => entry.encrypted)) throw bookError("passwordProtected");
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  return {
    names: [...byName.keys()],
    read: async (name) => new Blob([await worker.call({ type: "read", index: byName.get(name).index })]),
    raw: { entries },
  };
}

/**
 * Opens a .cbr or .cb7. libarchive reads RAR 4 and 5 and 7-Zip, solid or
 * not, but not password-protected ones. Pages are unpacked when they're
 * needed, and let go of when they're far from the one shown.
 *
 * A RAR archive that isn't solid, as most comics are, is read a page at a
 * time; from a URL, on a server that takes range requests, only the pages
 * read are downloaded. A solid one, or a 7-Zip one, can only be unpacked
 * from the start, so it's held whole by the worker.
 *
 * The worker comes from `opts.comicArchive.workerUrl`, else beside
 * epubier.all.min.js, else the CDN. It finds its libarchive.wasm beside
 * itself.
 *
 * @param {HTMLElement} viewer
 * @param {string | ArrayBuffer | Blob} input
 * @param {{opts: object, flow?: "paginated" | "scrolled", t: (key: string, vars?: object) => string}} ctx
 * @param {string} [bundledWorker]
 */
export async function open(viewer, input, ctx, bundledWorker) {
  const source = await openSource(input);
  if (isZip(await source.bytes(0, 4))) return openZip(viewer, source, ctx);

  const url = new URL(ctx.opts.comicArchive?.workerUrl || bundledWorker || cdnWorker(), location.href).href;
  let worker;
  const startedWorker = () => (worker ||= startWorker(url));
  try {
    const rar = await readRar(source).catch(() => null);
    const archive = rar && !rar.solid ? piecewise(source, rar, startedWorker) : await whole(source, startedWorker());
    const close = () => {
      source.close();
      worker?.close();
    };
    return await comicSession(viewer, { ...archive, close }, ctx);
  } catch (e) {
    source.close();
    worker?.close();
    throw e;
  }
}
