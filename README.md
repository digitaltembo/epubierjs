# epubier

A drop-in ebook reader UI built on [epub.js](https://github.com/futurepress/epub.js). It reads ePubs out of the box, and optionally PDFs (with [PDF.js](https://mozilla.github.io/pdf.js/)), comic books (`.cbz`, and `.cbr` and `.cb7` with [libarchive](https://libarchive.org)) Kindle books (`.mobi`, `.azw3`, with [mobi-parser](https://github.com/hhk-png/lingo-reader)) and RTF documents (with [rtf.js](https://github.com/tbluemel/rtf.js)); see [Formats](#formats). It adds:

- one- or two-page layout, chosen by the space available, with a cover page shown on its own like the front of a book
- a table of contents, the current chapter, page numbers and a progress slider
- search across the whole book
- bookmarks and colored highlights, saved in the browser
- links to a page or a passage, shared through the system share sheet on phones or copied to the clipboard elsewhere
- swipes and tap zones for turning pages
- an immersive layout on phones and tablets, where the page fills the reader and a tap shows the toolbars
- a fullscreen mode
- settings for the page color (white, sepia, dark sepia or black), pages or one long scroll, page turns sliding or not, the font, the text size and the text alignment
- the reading position in the URL (`#loc=42`), so links and reloads come back to the same place

## Installation

```sh
npm install epubier
```

Or load it from a CDN, with no build step:

```html
<script src="https://cdn.jsdelivr.net/npm/epubier@0.4/dist/epubier.min.js"></script>
```

Each format is its own subpackage, built on the libraries below. `epubier` and `epubier.min.js` read ePubs only; `epubier/all` and `epubier.all.min.js` read every format (see [Usage](#usage)).

| Format | Extensions | Subpackage | Built on | To install |
| ------ | ---------- | ---------- | -------- | ---------- |
| ePub   | `.epub` | `epubier/formats/epub` | [epub.js](https://github.com/futurepress/epub.js), with [JSZip](https://stuk.github.io/jszip/) | nothing (dependencies of epubier) |
| Kindle | `.mobi`, `.azw3`, `.azw` | `epubier/formats/mobi` | [mobi-parser](https://github.com/hhk-png/lingo-reader), turned into an ePub for epub.js | `@lingo-reader/mobi-parser` |
| RTF    | `.rtf` | `epubier/formats/rtf` | [rtf.js](https://github.com/tbluemel/rtf.js), turned into an ePub for epub.js | `rtf.js` |
| PDF    | `.pdf` | `epubier/formats/pdf` | [PDF.js](https://mozilla.github.io/pdf.js/) | `pdfjs-dist` |
| Comic  | `.cbz` | `epubier/formats/cbz` | the browser's own `DecompressionStream` | nothing |
| Comic  | `.cbr`, `.cb7` | `epubier/formats/comicarchive` | [libarchive](https://libarchive.org), through [libarchive.js](https://github.com/nika-begiashvili/libarchivejs), in epubier's worker | nothing (the worker is in `dist/`; see [Comics](#comics)) |

The libraries to install are optional peer dependencies, needed only for the formats you use:

```sh
npm install pdfjs-dist                  # PDFs
npm install @lingo-reader/mobi-parser   # Kindle books
npm install rtf.js                      # RTF documents
```

The self-contained `epubier.all.min.js` already includes them.

## Usage

### Script tags

```html
<script src="https://cdn.jsdelivr.net/npm/epubier@0.4/dist/epubier.min.js"></script>

<div id="reader" style="height: 100vh"></div>
<script>
  const reader = epubier(document.getElementById("reader"), "books/moby-dick.epub", {
    onBackPressed: () => history.back(),
    styles: { accent: "#1d4ed8" },
  });
</script>
```

`epubier.min.js` is self-contained: it includes epub.js, JSZip and their dependencies (about 465kb minified, 140kb gzipped). It reads ePubs only.

`epubier.all.min.js` reads every format, and is otherwise the same: it adds PDF.js, the Kindle parser and rtf.js (about 1.2mb minified, 355kb gzipped). It also uses two workers, PDF.js's `pdf.worker.min.mjs`, and `comicarchive.worker.js` with `libarchive.wasm` for `.cbr` and `.cb7` comics, which are beside it in `dist/` and which it loads from its own folder; host them together. See [PDFs](#pdfs) for the rest of PDF.js's files.

```html
<script src="https://cdn.jsdelivr.net/npm/epubier@0.4/dist/epubier.all.min.js"></script>
```

### Bundlers

```js
import epubier from "epubier"; // epubjs comes with it as a dependency

epubier(element, "books/moby-dick.epub");
```

That reads ePubs only, and brings nothing for the other formats. For all of them:

```js
import epubier from "epubier/all";

epubier(element, "books/moby-dick.pdf");
```

Or for just the formats you want, put a reader together from `epubier/core` and the formats in `epubier/formats/`:

```js
import { createEpubier } from "epubier/core";
import pdf from "epubier/formats/pdf";
import cbz from "epubier/formats/cbz";

const epubier = createEpubier([pdf, cbz]); // no epub.js in the bundle
epubier(element, "books/watchmen.cbz");
```

The formats are `epubier/formats/epub`, `…/pdf`, `…/cbz`, `…/comicarchive` (`.cbr`, `.cb7`), `…/mobi` and `…/rtf`. All but ePub are loaded on demand: the bundler splits each into its own chunk (with PDF.js, the Kindle parser or rtf.js), fetched the first time a book of that format is opened.

The ES module build is for bundlers (Vite, webpack, esbuild, Rollup and the like): it imports epub.js's own ES modules, from `epubjs/src/`, so that epubier's fixes to epub.js apply to the copy it runs. It's browser-only; importing it under Node isn't supported. The self-contained scripts are also available to bundlers as `epubier/dist/epubier.min.js` and `epubier/dist/epubier.all.min.js`.

### TypeScript

Type declarations come with the package (`epubier.d.ts`, and `types/` for the other entry points): the options, the location passed to `onLocationChange`, the returned reader, whose `book` and `rendition` use epub.js's own types, and the format and session interfaces. Those bring in JSZip's, which refer to Node's types, so a project that type-checks libraries (`skipLibCheck: false`) also needs `@types/node`.

## API

### `epubier(element, path, opts?)`

Replaces `element` with the reader and opens the book at `path`: a URL, or the book's contents as an `ArrayBuffer` or `Blob` (for books held in IndexedDB, OPFS or a file input; PDFs and comics read a URL or `Blob` only as they need it, so a large one isn't loaded whole; with `epubier` itself, a `blob:` URL won't do, because epub.js tells ePubs apart by their `.epub` extension).

A reader with several formats (`epubier/all`, or `createEpubier()` with more than one) picks one by the `format` option, else the URL's extension, else the book's first bytes. With a URL that has no telling extension (a `blob:` URL, an API route), it fetches the book first to look: just its first kilobyte, with a range request, when it turns out to be a PDF or a comic, which read the rest as they need it. The reader keeps the element's id, classes and inline style. It fills the height it's given and has none of its own, so give the element (or its container) a height.

Options:

| Option          | Type                     | Description |
| --------------- | ------------------------ | ----------- |
| `onBackPressed` | `() => void`             | Shows a back button in the toolbar, which calls this. Without it there is no back button. |
| `toolbar`       | `object`                 | Which of the toolbar's buttons to show: `{ back, contents, bookmark, fullscreen, share, search }`, each shown unless `false`, e.g. `{ share: false }`. Leaving out bookmark or fullscreen turns off its key too. |
| `share`         | `boolean`                | Whether links to a page or passage can be shared. `false` leaves out every share button: the toolbar's, a selection's and the notes'. Default `true`. |
| `titleBar`      | `boolean`                | Makes the toolbar the title bar of a window without one (an Electron window with `titleBarStyle: "hidden"`, a web app's window controls overlay): dragging it moves the window. See [Title bars](#title-bars). Default `false`. |
| `styles`        | `Record<string, string>` | Theme overrides. See below. |
| `css`           | `string`                 | Extra CSS added to the page alongside the reader's own, for anything the theme doesn't cover. |
| `themes`        | `object \| false`        | Changes to the themes in the settings tab. See [Themes](#themes). |
| `theme`         | `string`                 | The theme to start with, until the reader chooses one. Default `"white"`. |
| `fonts`         | `object \| false`        | Changes to the fonts in the settings tab. See [Fonts](#fonts). |
| `font`          | `string`                 | The font to start with, until the reader chooses one. Default `"original"`, the book's own. |
| `strings`       | `object`                 | Changes to the reader's text, to reword or translate it. See [Text and translations](#text-and-translations). |
| `immersive`     | `boolean`                | Whether phones and tablets held upright, and phones on their side, get the immersive layout, as in fullscreen. Default `true`. |
| `flow`          | `string`                 | Pages (`"paginated"`, the default) or one long scroll (`"scrolled"`), to start with until the reader chooses one. |
| `pageTurn`      | `string`                 | How pages turn, to start with until the reader chooses: the page sliding off to the left (`"slide"`, the default), or straight to the next (`"none"`). Pages never slide where the system asks for reduced motion, or in browsers without view transitions. |
| `align`         | `string`                 | The text alignment to start with, until the reader chooses one: `"justify"` (default), `"left"`, `"right"` or `"original"`. |
| `textSize`      | `number`                 | The text size to start with, until the reader chooses one, as a percentage of the book's own: `70`, `80`, `90`, `100` (default), `110`, `120`, `135`, `150`, `175` or `200`. |
| `zoom`          | `number`                 | For PDFs and comics, the zoom to start with, until the reader chooses one, as a percentage of fitting the screen: `50`, `75`, `100` (default), `125`, `150`, `200`, `250`, `300` or `400`. |
| `storageKey`    | `string`                 | What the book's saved data is keyed by, instead of its URL. Required when `path` is an `ArrayBuffer` or `Blob`; use something stable, like a content hash. |
| `position`      | `string`                 | A location to open at (a CFI, or a page number for PDFs and comics; see `onLocationChange`), instead of the position saved in this browser, e.g. one kept by your own app. A `#loc` link in the URL still takes precedence. |
| `format`        | `string`                 | The book's format, `"epub"`, `"pdf"`, `"cbz"`, `"comicarchive"`, `"mobi"` or `"rtf"`, when neither its URL nor its contents tell. Only matters to a reader with several formats. |
| `pdf`           | `object`                 | Where PDF.js finds its files: `{ workerSrc, assetsUrl }`. See [PDFs](#pdfs). |
| `replacements` | `"blobUrl" \| "base64"` | How pages refer to the book's images, styles and fonts when it's opened from a file or `ArrayBuffer`: blob URLs (default) or data URLs. Some Android WebViews take a fifth of a second per blob URL, which delays opening a book with many images. |
| `onLocationChange` | `(location) => void`  | Called whenever the position changes, with `{ location, progress, page, totalPages }`, and for ePubs `cfi` too. `location` is a CFI for ePubs and Kindle books, and the page number (as a string) for PDFs and comics; it's what `position` takes. `progress` (0–1) and the page numbers are `null` until the pages have been counted, and it's called again once they have. |
| `onFullscreenChange` | `(fullscreen) => void` | Called whenever the reader goes in or out of fullscreen: by its button, its key (F), Escape, leaving the browser's fullscreen, or `setFullscreen`. |
| `browserFullscreen` | `boolean` | Whether the reader's fullscreen also shows it in the browser's fullscreen. Set `false` where the host shows its window fullscreen itself (a desktop app's) from `onFullscreenChange`, and calls `setFullscreen` when the window goes in or out of fullscreen on its own. Default `true`. |
| `onThemeChange` | `(theme) => void` | Called with the theme in use when the reader opens and whenever one is chosen, with `{ id, background, dark }`: `background` is the reader's background color as computed, and `dark` whether it's dark. For matching the page around the reader to it. |

Returns `{ element, session, ready, book, rendition, setFullscreen, destroy }`:

- `element`: the reader's root element.
- `session`: what shows the book (see [Custom formats](#custom-formats)), once it's open, e.g. `reader.session.metadata.then(m => document.title = m.title)`. Its `raw` has the format's own objects: `{ book, rendition }` for ePubs and Kindle books, `{ pdf }` (PDF.js's document) for PDFs, `{ entries }` (the files in the archive) for comics.
- `ready`: a promise of the session, once the book is open, or of `null` if it couldn't be opened. ePubs open straight away; the other formats have their code and the book to load first.
- `book`, `rendition`: the underlying epub.js objects, for ePubs (straight away) and Kindle books (once open), e.g. `reader.book.loaded.metadata.then(m => document.title = m.title)`.
- `setFullscreen(on)`: turns the reader's fullscreen on or off, as its button does (once the book is open, if it isn't yet), e.g. when the window it's in goes fullscreen.
- `destroy()`: tears the reader down and puts the original element back.

### Styles

`styles` takes these names, or any `--custom-property`:

| Name           | Variable          | Default               |
| -------------- | ----------------- | --------------------- |
| `background`   | `--ep-bg`         | `#f4f1ea`             |
| `page`         | `--ep-page`       | `#fff`                |
| `text`         | `--ep-ink`        | `#24231f`             |
| `muted`        | `--ep-muted`      | `#686157`             |
| `border`       | `--ep-line`       | `#d3cbbc`             |
| `accent`       | `--ep-accent`     | `#8a5a1c`             |
| `font`         | `--ep-font`       | `system-ui, sans-serif` |
| `fontSize`     | `--ep-font-size`  | `15px`                |
| `maxPageWidth` | `--ep-max-width`  | `66rem` (a two-page spread) |

These style the reader's UI, and are the White theme's colors. The book's own fonts and layout are the book's, except as the settings change them. The variables can also be set from your own CSS, e.g. `#reader { --ep-accent: crimson; }`. For anything else, the reader's classes all start with `ep-` under a `.epubier` root.

### Title bars

In a window without a title bar, the reader's toolbar can be one: `titleBar: true` lets it move the window, and two variables keep its ends clear of the window's own buttons, padding the toolbar and the panels' headers, which cover it:

| Variable                   | Default |
| -------------------------- | ------- |
| `--ep-toolbar-inset-left`  | `0px`   |
| `--ep-toolbar-inset-right` | `0px`   |

For example, in Electron on macOS, with `titleBarStyle: "hiddenInset"`:

```js
epubier(element, url, { titleBar: true, styles: { "--ep-toolbar-inset-left": "72px" } });
```

### Themes

The settings tab offers Black, Sepia dark, Sepia light and White (the default). A theme sets any of the `styles` names on top of `styles`, and the book's text takes its `text` color. White sets nothing, so it looks exactly as `styles` describes.

`themes` changes that list. An entry for a built-in theme (`black`, `sepiaDark`, `sepiaLight`, `white`) changes just the values it gives. `null` removes a theme, and any other name adds one, listed after the built-in ones. `false` removes them all, and with them the theme setting.

```js
epubier(element, path, {
  themes: {
    black: null,
    sepiaLight: { page: "#faf3e3" },
    night: { label: "Night", dark: true, background: "#0d1117", page: "#161b22", text: "#c9d1d9", muted: "#8b949e", border: "#30363d", accent: "#58a6ff" },
  },
});
```

`dark` says whether the page is dark, which changes how highlights are blended with it and makes all of the book's text the theme's `text` color. Without it, it's worked out from the `page` color.

### Fonts

The settings tab offers the book's own font (`original`, the default) and five from [Google Fonts](https://fonts.google.com): Literata (`literata`), Lora (`lora`), EB Garamond (`garamond`), Source Sans (`sourceSans`) and Atkinson Hyperlegible (`atkinson`). A font's stylesheet is loaded only when it's chosen. The settings tab shows each name in its own font, and fetches only the letters of those names when it's first opened.

`fonts` changes that list the same way `themes` does. A font is `{ label, family, url }`: `family` is a CSS `font-family`, and `url` is a stylesheet that provides it. Leave out `url` for fonts that need no loading.

```js
epubier(element, path, {
  fonts: {
    lora: null,
    georgia: { label: "Georgia", family: "Georgia, serif" },
  },
});
```

Pass `fonts: false` to keep every font request away from Google.

### Text and translations

All of the reader's text, from button labels to error messages, is in [`src/strings.json`](src/strings.json) (also `epubier/strings.json`), in English. `strings` changes any of it, nested the same way; anything it leaves out stays as it is. To translate the reader, copy that file, translate it, and pass it whole:

```js
import german from "./strings.de.json";

epubier(element, path, { strings: german });

// Or just reword a little
epubier(element, path, { strings: { toc: { empty: "No chapters" }, themes: { sepiaLight: "Paper" } } });
```

`{name}` in a string is filled in, e.g. `"Page {page} of {total}"`. A string that varies by number is an object of plural forms, keyed by [`Intl.PluralRules`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules) category for the strings' `locale` (`"en"` by default), e.g. `{ "one": "{count} result", "other": "{count} results" }`; give the categories the language has, like `few` and `many`. Theme and font names are under `themes` and `fonts`, by id, including any you add, unless the theme or font gives its own `label`.

## Formats

What each format can do (for its subpackage and libraries, see [Installation](#installation)):

| Format | Extensions | Pages | Search | Highlights | Font & text settings |
| ------ | ---------- | ----- | ------ | ---------- | -------------------- |
| ePub   | `.epub` | ~1,500-character stretches | ✓ | ✓ | ✓ |
| Kindle | `.mobi`, `.azw3`, `.azw` | as ePub | ✓ | ✓ | ✓ |
| RTF    | `.rtf` | as ePub | ✓ | ✓ | ✓ |
| PDF    | `.pdf` | the PDF's pages | ✓ | | |
| Comic  | `.cbz` | the images | | | |
| Comic  | `.cbr`, `.cb7` | the images | | | |

Everything else (the table of contents, bookmarks, links to pages, themes, pages or a scroll, fullscreen, swipes and the keyboard) works the same for each. The reader leaves out what a format can't do: no search button for comics, and no font, text size or alignment settings for PDFs and comics.

### PDFs

Pages are drawn by PDF.js, one at a time or two side by side when there's room, the first on its own like a cover. The table of contents is the PDF's outline, and search goes through its text (results go to the page, without marking the words on it). Pages are sized by the first page's shape.

PDF.js needs a worker script, and for some PDFs it fetches character maps (for CJK text in older PDFs), the standard fonts (for PDFs that don't embed theirs) and image decoders. By default they come from [jsDelivr](https://www.jsdelivr.com/package/npm/pdfjs-dist), in the version of PDF.js in use, except that `epubier.all.min.js` loads the worker from its own folder, and that a worker already set in PDF.js's `GlobalWorkerOptions` is kept. To serve them yourself (e.g. in an app that works offline):

```js
epubier(element, "books/report.pdf", {
  pdf: {
    workerSrc: "/pdfjs/build/pdf.worker.min.mjs", // pdfjs-dist's build/pdf.worker.min.mjs
    assetsUrl: "/pdfjs/", // a copy of pdfjs-dist's folder, for its cmaps/, standard_fonts/ and wasm/
  },
});
```

The worker has to be the same version as PDF.js itself. `pdfjs-dist` 5 or later is supported.

### Comics

A `.cbz` is a zip of images. Its pages are those images (JPEG, PNG, GIF, WebP, AVIF, BMP) in natural file name order (`page2` before `page10`), and when they're in several folders, each folder is a chapter. The title and writer come from a `ComicInfo.xml`, where there is one. Pages are laid out like a PDF's, sized by the first page's shape.

Pages are unpacked as they're needed, and let go of when they're far from the one shown, so a comic of hundreds of megabytes doesn't fill the memory with images. Where the archive allows, a page is read on its own, without the rest of the comic:

- From a URL, on a server that takes range requests (most static hosts and CDNs do), only the pages read are downloaded, and the archive's directory. Cross-origin, the server has to expose `Content-Range` to CORS. On a server that doesn't, or for a comic that has to be read whole, the comic is downloaded whole, and kept as a `Blob` (which browsers can keep on disk when it's large).
- From a `Blob` or `File`, pages are read straight out of it, so opening a large comic from a file input or OPFS doesn't load it into memory.

A `.cbz` is always read this way: the zip's directory says where each page is, and a compressed page is inflated by the browser's own `DecompressionStream`.

`.cbr` (RAR) and `.cb7` (7-Zip) comics are read by [libarchive](https://libarchive.org): RAR 4 and RAR 5, solid or not, and 7-Zip, but not password-protected ones. libarchive is free software (BSD), unlike RARLAB's UnRAR, whose license forbids using it to make a RAR-compatible archiver. It runs in a worker, `comicarchive.worker.js`.

- A RAR archive that isn't solid, as most comics are, is read a page at a time. Its headers say where each page is: a RAR 5 archive usually has a copy of them near its end, so they come in a few requests; otherwise they're read one by one, a request each from a URL. A stored page (as pages often are, being already-compressed images) is read as it is, and a compressed one is unpacked by the worker on its own, so the worker isn't even started for a comic whose pages are all stored.
- A solid RAR archive, or a 7-Zip one (which are nearly always solid), can only be unpacked from the start. It's read whole, and the worker holds it in its memory and unpacks a page when it's asked for, carrying on from the last one, so reading forwards is quick; going back starts again from the top. libarchive's WebAssembly can't hold much over 2gb, so solid archives bigger than that can't be opened.

A `.cbr` that's really a zip, as many are, opens like a `.cbz`.

The worker loads `libarchive.wasm` (about 1mb, 480kb gzipped) from beside itself. `epubier.all.min.js` loads the worker from its own folder; otherwise it comes from [jsDelivr](https://www.jsdelivr.com/package/npm/epubier), in the version of epubier in use. To serve it yourself, copy `dist/comicarchive.worker.js` and `dist/libarchive.wasm` together:

```js
epubier(element, "books/watchmen.cbr", {
  comicArchive: { workerUrl: "/epubier/comicarchive.worker.js" }, // with libarchive.wasm beside it
});
```

The worker is started from a `blob:` module that imports it, so it can come from another origin; a Content Security Policy needs to allow `blob:` workers.

### Kindle books

MOBI and KF8 (`.azw3`) books are parsed by `@lingo-reader/mobi-parser` and turned into an ePub in memory, which the reader then shows like any other: so they reflow, take the font and text settings, and can be searched and highlighted. The same book always turns into the same ePub, so saved positions and highlights stay put. Links within an older MOBI book go to the start of the chapter they point into. Books with DRM can't be opened.

### RTF documents

RTF documents are turned into HTML by [rtf.js](https://github.com/tbluemel/rtf.js), and then into an ePub of one chapter, read like a Kindle book: they reflow, take the font and text settings, and can be searched and highlighted. The title and author come from the document's info, where it has them. Pictures are shown, Windows metafiles (WMF, EMF) included. RTF has no table of contents to show. rtf.js carries tables for every legacy code page, so it's about 2mb, loaded only when a document is opened.

### Custom formats

A format is an object, passed to `createEpubier()`:

```js
const myFormat = {
  id: "myformat",                 // for the `format` option, and saved data's keys
  extensions: ["xyz"],            // without the dot
  test: (bytes) => /* is this Uint8Array (the first 1024 bytes) one of these? */,
  load: () => import("./my-session.js"), // or `open` itself, to have it straight away
  piecewise: true,                // optional; see below
};
```

`open(viewer, input, ctx)` shows the book (`input`: a URL, or an `ArrayBuffer`, or a `Blob` for a `piecewise` format) in `viewer`, and returns a session (or a promise of one): an object that turns pages, reports where it is, and says what it can do. `EpubierSession` in `epubier.d.ts` describes it, and `src/formats/paged.js` makes one for books of fixed pages, given how to draw a page, as the PDF and comic formats do (with pages and a scroll both). A session with `setFlow` gets the Layout setting, and starts as `ctx.flow`; one with `setZoom` gets the Zoom setting. `ctx.t(key, vars)` gives the reader's text (see [Text and translations](#text-and-translations)), e.g. `ctx.t("comic.page", { page: 3 })`.

A format with `piecewise: true` reads a URL or `Blob` itself, just the parts it needs (as the comic formats do, with range requests or `Blob.slice`, and PDF.js does with a URL), so `open` gets them as they are. A book given as a URL with no extension that tells its format (a `blob:` URL, an API route) is fetched to look at its first bytes: for those formats, only its first kilobyte, with a range request. Other formats get the whole book, as an `ArrayBuffer`.

## Things to know

- **The URL hash.** The reader keeps `#loc=<page>` (and `&hl=<passage>` for shared passages) in `location.hash`, replacing the history entry rather than adding one, and follows those links when the page opens or the hash changes. Don't use the hash for anything else on the same page.
- **Saved data.** Reading position, page counts, bookmarks and highlights go in `localStorage`, keyed by the book's format and URL (or `storageKey`): `epub-position:<url>` and so on, `pdf-…` for a PDF. They stay in that browser, and are lost if the key changes. The theme, layout, font, text size and alignment chosen in the settings are saved for all books (`epubier-theme`, `epubier-flow`, `epubier-page-turn`, `epubier-font`, `epubier-text-size`, `epubier-align`, and `epubier-zoom` for PDFs and comics).
- **Changing the font, text size or alignment** reflows the book and keeps the same passage on screen.
- **Pages or a scroll.** The Layout setting changes between turning pages and scrolling through the book, staying at the same place. As a scroll, an ePub or Kindle book runs on from one chapter into the next, in a column narrowed to a comfortable line length (44rem at most); PDFs and comics are a column of pages as wide as the reader, drawn as they come into view. The arrows, keys and taps still move a screen at a time.
- **Zoom.** PDFs and comics have no text to restyle, so in place of the font, text size and alignment settings they have a zoom, from 50% to 400% of fitting the screen. Zoomed in, the page scrolls around, and sideways swipes move around it rather than turning the page.
- **Text size** scales the book's root font size, which works for books that size their text in `em`, `rem` or `%` (nearly all). Text sized in `px` stays as it is.
- **Text alignment** applies to the book's ordinary paragraphs, the ones aligned to the start or justified. Anything the book centers or aligns to the other side, like headings and title pages, keeps its alignment. Justified text is hyphenated where the browser can.
- **Page numbers** in ePubs and Kindle books are fixed ~1,500-character stretches of text, so they're the same on any screen. They're counted the first time a book is opened (a few seconds; a spinner shows meanwhile) and cached after that. In PDFs and comics, they're the pages.
- **Keyboard:** ←/→ and PageUp/PageDown turn pages, `B` bookmarks, `F` toggles fullscreen, Esc closes menus and panels.
- **Immersive layout.** On phones and tablets held upright, and phones on their side, the page fills the reader, without the arrows and margins, and the toolbars float over it: tap the left or right third to turn pages and the middle to show or hide them. They show for a few seconds when the book opens, to show they're there. Tablets on their side, with room to spare, have the usual layout. Set `immersive: false` to always have the usual layout.
- **Fullscreen** covers the window, in the immersive layout, and uses the browser's fullscreen mode where it's available (not on iPhone).
- **On a phone held upright** (a touch screen in portrait), the page arrows are hidden so the page takes the full width. Swipe, or tap the left or right third of the page, to turn pages.

## Development

```sh
npm install
npm run build   # dist/epubier.min.js, dist/epubier.all.min.js (+ .maps, and PDF.js's worker) and dist/esm/
npm start       # rebuilds on change and serves http://localhost:8000/example/
```

The example opens `example/book.epub`, or another book with `?book=path/to/book.epub`. `example/all.html` is the same with every format, e.g. `?book=book.pdf`.

Source layout:

- `src/index.js`: the `epubier()` entry point, for ePubs; `epubier.d.ts` its type declarations
- `src/all.js`: `epubier/all`, every format; `src/core.js`: `createEpubier()`, and picking a book's format
- `src/reader.js`: the reader's behaviour, around a format's session
- `src/formats/`: the formats. `epub/` (with `patches.js`, fixes to epub.js applied to its classes when it loads), `mobi/` and `rtf/` (turn Kindle books and RTF documents into ePubs, with `epub/build.js`), `pdf/`, `comic/` and `comicarchive/` (through `paged.js`, for books of fixed pages; `comic/` has the zip reader, and `comicarchive/` the RAR header reader and the worker, `worker.js`, and uses `comic/`'s session); `source.js` reads a book a piece at a time, from a `Blob` or with range requests
- `src/template.js`, `src/icons.js`: markup
- `src/strings.json`: the reader's text; `src/strings.js` looks it up, with `strings` merged in, and makes errors that show in it
- `src/themes.js`, `src/fonts.js`: the built-in themes and fonts
- `src/styles.js`: the stylesheet and theme overrides
- `src/storage.js`, `src/share.js`: localStorage and sharing helpers

## Publishing

`npm run release` logs in to npm if the session has expired, then publishes; `npm publish` builds first (`prepublishOnly`). `npm pack --dry-run` lists what goes in the package: `dist/`, `src/`, `epubier.d.ts`, `types/`, the licenses and this README.

## License

[MIT](LICENSE). `epubier.min.js` also contains epub.js (BSD-2-Clause), JSZip (used under MIT), localforage (Apache-2.0) and smaller MIT/ISC packages; `epubier.all.min.js` adds PDF.js (Apache-2.0), mobi-parser, fflate and rtf.js (MIT), sax (BlueOak-1.0.0) and codepage (Apache-2.0). The build finds them from what esbuild actually bundled, writes their licenses to [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES), and puts each file's at its top, so shipping that one file meets every license. `pdf.worker.min.mjs` is PDF.js's own, with its license at its top; `comicarchive.worker.js` and `libarchive.wasm` contain libarchive.js (MIT) and its build of libarchive (BSD-2-Clause) with zlib, bzip2, xz and OpenSSL; the worker carries their notices. The ES modules in `dist/esm/` bundle none of them and carry only epubier's license and the epub.js notice.
