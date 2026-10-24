import { readZip } from "./zip.js";
import { pagedSession } from "../paged.js";
import { openSource } from "../source.js";
import { bookError } from "../../strings.js";

const IMAGE_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
};
const extension = (name) => name.split(".").pop().toLowerCase();
const folder = (name) => name.slice(0, name.lastIndexOf("/") + 1);
/** Image URLs kept this many pages either side of the one shown */
const KEEP = 6;

/** Title and writer from a ComicInfo.xml, the de facto metadata file for comics */
function comicInfo(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const field = (name) => doc.querySelector(`ComicInfo > ${name}`)?.textContent.trim() || "";
  const series = field("Series"),
    number = field("Number");
  return {
    title: field("Title") || (series && (number ? `${series} #${number}` : series)),
    creator: field("Writer"),
  };
}

/**
 * Opens a .cbz. Its pages are its images, in natural file name order, and
 * when they're in several folders, each folder is a chapter. Pages are
 * unpacked as they're needed, and let go of when they're far from the one
 * shown. From a URL, on a server that takes range requests, only those
 * pages are downloaded.
 *
 * @param {HTMLElement} viewer
 * @param {string | ArrayBuffer | Blob} input
 * @param {{flow?: "paginated" | "scrolled"}} ctx
 */
export async function open(viewer, input, ctx) {
  return openZip(viewer, await openSource(input), ctx);
}

/** Opens a .cbz from a Source (see ../source.js) */
export async function openZip(viewer, source, ctx) {
  try {
    const entries = await readZip(source);
    const files = new Map(entries.map((file) => [file.name, file]));
    const archive = { names: [...files.keys()], read: (name) => files.get(name).read(), raw: { entries } };
    return await comicSession(viewer, { ...archive, close: source.close }, ctx);
  } catch (e) {
    source.close();
    throw e;
  }
}

/**
 * A comic's session, from any kind of archive: the names of the files in
 * it ("/"-separated paths), a way to read one by name, and what to do once
 * the comic's closed.
 *
 * @param {HTMLElement} viewer
 * @param {{names: string[], read: (name: string) => Promise<Blob>, raw: object, close?: () => void}} archive
 * @param {{flow?: "paginated" | "scrolled", t: (key: string, vars?: object) => string}} ctx
 */
export async function comicSession(viewer, { names, read, raw, close }, { flow, t }) {
  const files = names
    .filter((name) => IMAGE_TYPES[extension(name)] && !/(^|\/)(__MACOSX|\.)/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  if (!files.length) throw bookError("noPages");

  const urls = new Map();
  let closed = false;
  function url(index) {
    if (!urls.has(index)) {
      const name = files[index];
      const promise = read(name).then((blob) => URL.createObjectURL(new Blob([blob], { type: IMAGE_TYPES[extension(name)] })));
      urls.set(index, promise);
      // Tried again the next time it's wanted
      promise.catch(() => urls.get(index) === promise && urls.delete(index));
    }
    return urls.get(index);
  }
  /** Lets go of images far from page `index`, so a long comic doesn't pile them all up */
  function release(index) {
    for (const [i, promise] of urls) {
      if (Math.abs(i - index) <= KEEP) continue;
      urls.delete(i);
      promise.then((u) => URL.revokeObjectURL(u), () => {});
    }
  }

  // Pages are assumed to share the first one's shape
  const cover = new Image();
  cover.src = await url(0);
  await cover.decode().catch(() => {});
  const aspect = cover.naturalWidth && cover.naturalHeight ? cover.naturalWidth / cover.naturalHeight : 2 / 3;

  const infoFile = names.find((name) => /(^|\/)ComicInfo\.xml$/i.test(name));
  const metadata = infoFile
    ? read(infoFile)
        .then((blob) => blob.text())
        .then(comicInfo, () => ({}))
    : Promise.resolve({});

  const toc = [];
  files.forEach((name, i) => {
    const dir = folder(name);
    if (i === 0 || dir !== folder(files[i - 1])) {
      toc.push({
        label: dir.split("/").filter(Boolean).pop() || t("toc.start"),
        target: String(i + 1),
        index: i + 1,
        subitems: [],
      });
    }
  });

  return pagedSession(
    viewer,
    {
      count: files.length,
      aspect,
      raw,
      metadata,
      toc: Promise.resolve(toc.length > 1 ? toc : []),
      render(index, slot) {
        const img = document.createElement("img");
        img.alt = t("comic.page", { page: index + 1 });
        img.decoding = "async";
        slot.append(img);
        url(index).then(
          (u) => {
            img.src = u;
            release(index);
          },
          (error) => closed || console.error(error),
        );
      },
      prefetch(index) {
        url(index).then(
          (u) => {
            const img = new Image();
            img.src = u;
            img.decode().catch(() => {});
          },
          () => {},
        );
      },
      destroy() {
        closed = true;
        for (const promise of urls.values()) promise.then((u) => URL.revokeObjectURL(u), () => {});
        urls.clear();
        close?.();
      },
    },
    flow,
  );
}
