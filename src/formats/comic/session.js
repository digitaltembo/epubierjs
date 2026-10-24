// The same JSZip build epub.js uses, so a reader with both has one copy
import JSZip from "jszip/dist/jszip";
import { pagedSession } from "../paged.js";
import { bookBytes } from "../fetch.js";

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
 * when they're in several folders, each folder is a chapter.
 *
 * @param {HTMLElement} viewer
 * @param {string | ArrayBuffer} input
 * @param {{flow?: "paginated" | "scrolled"}} ctx
 */
export async function open(viewer, input, { flow }) {
  const zip = await JSZip.loadAsync(await bookBytes(input));
  const files = Object.values(zip.files)
    .filter((f) => !f.dir && IMAGE_TYPES[extension(f.name)] && !/(^|\/)(__MACOSX|\.)/.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  if (!files.length) throw new Error("There are no pages in this comic");

  const urls = new Map();
  function url(index) {
    if (!urls.has(index)) {
      const file = files[index];
      urls.set(
        index,
        file
          .async("blob")
          .then((blob) => URL.createObjectURL(new Blob([blob], { type: IMAGE_TYPES[extension(file.name)] }))),
      );
    }
    return urls.get(index);
  }
  /** Lets go of images far from page `index`, so a long comic doesn't pile them all up */
  function release(index) {
    for (const [i, promise] of urls) {
      if (Math.abs(i - index) <= KEEP) continue;
      urls.delete(i);
      promise.then((u) => URL.revokeObjectURL(u));
    }
  }

  // Pages are assumed to share the first one's shape
  const cover = new Image();
  cover.src = await url(0);
  await cover.decode().catch(() => {});
  const aspect = cover.naturalWidth && cover.naturalHeight ? cover.naturalWidth / cover.naturalHeight : 2 / 3;

  const infoFile = Object.values(zip.files).find((f) => /(^|\/)ComicInfo\.xml$/i.test(f.name));
  const metadata = infoFile ? infoFile.async("string").then(comicInfo, () => ({})) : Promise.resolve({});

  const toc = [];
  files.forEach((file, i) => {
    const dir = folder(file.name);
    if (i === 0 || dir !== folder(files[i - 1].name)) {
      toc.push({
        label: dir.split("/").filter(Boolean).pop() || "Start",
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
      raw: { zip },
      metadata,
      toc: Promise.resolve(toc.length > 1 ? toc : []),
      render(index, slot) {
        const img = document.createElement("img");
        img.alt = `Page ${index + 1}`;
        img.decoding = "async";
        slot.append(img);
        url(index).then((u) => {
          img.src = u;
          release(index);
        });
      },
      prefetch(index) {
        url(index).then((u) => {
          const img = new Image();
          img.src = u;
          img.decode().catch(() => {});
        });
      },
      destroy() {
        for (const promise of urls.values()) promise.then((u) => URL.revokeObjectURL(u));
        urls.clear();
      },
    },
    flow,
  );
}
