# epubier

A drop-in ebook reader UI built on [epub.js](https://github.com/futurepress/epub.js). It reads ePubs out of the box, and optionally PDFs (with [PDF.js](https://mozilla.github.io/pdf.js/)), comic books (`.cbz`) and Kindle books (`.mobi`, `.azw3`, with [mobi-parser](https://github.com/hhk-png/lingo-reader)); see [Formats](#formats). It adds:

- one- or two-page layout, chosen by the space available, with a cover page shown on its own like the front of a book
- a table of contents, the current chapter, page numbers and a progress slider
- search across the whole book
- bookmarks and colored highlights, saved in the browser
- links to a page or a passage, shared through the system share sheet on phones or copied to the clipboard elsewhere
- swipes and tap zones for turning pages
- an immersive layout on phones and tablets, where the page fills the reader and a tap shows the toolbars
- a fullscreen mode
- settings for the page color (white, sepia, dark sepia or black), pages or one long scroll, the font, the text size and the text alignment
- the reading position in the URL (`#loc=42`), so links and reloads come back to the same place

## Installation

```sh
npm install epubier
```

Or load it from a CDN, with no build step:

```html
<script src="https://cdn.jsdelivr.net/npm/epubier@0.1/dist/epubier.min.js"></script>
```

For PDFs and Kindle books, also install the libraries they use (comics need nothing more):

```sh
npm install pdfjs-dist                  # PDFs
npm install @lingo-reader/mobi-parser   # Kindle books
```

## Usage

### Script tags

```html
<script src="https://cdn.jsdelivr.net/npm/epubier@0.1/dist/epubier.min.js"></script>

<div id="reader" style="height: 100vh"></div>
<script>
  const reader = epubier(document.getElementById("reader"), "books/moby-dick.epub", {
    onBackPressed: () => history.back(),
    styles: { accent: "#1d4ed8" },
  });
</script>
```

`epubier.min.js` is self-contained: it includes epub.js, JSZip and their dependencies (about 435kb minified, 130kb gzipped). It reads ePubs only.

`epubier.all.min.js` reads every format, and is otherwise the same: it adds PDF.js and the Kindle parser (about 990kb minified, 300kb gzipped). PDF.js also needs its worker, `pdf.worker.min.mjs`, which is beside it in `dist/` and which it loads from its own folder; host the two together. See [PDFs](#pdfs) for the rest of PDF.js's files.

```html
<script src="https://cdn.jsdelivr.net/npm/epubier@0.1/dist/epubier.all.min.js"></script>
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
import comic from "epubier/formats/comic";

const epubier = createEpubier([pdf, comic]); // no epub.js in the bundle
epubier(element, "books/watchmen.cbz");
```

The formats are `epubier/formats/epub`, `…/pdf`, `…/comic` and `…/mobi`. All but ePub are loaded on demand: the bundler splits each into its own chunk (with PDF.js, JSZip or the Kindle parser), fetched the first time a book of that format is opened.

The ES module build is for bundlers (Vite, webpack, esbuild, Rollup and the like): it imports epub.js's own ES modules, from `epubjs/src/`, so that epubier's fixes to epub.js apply to the copy it runs. It's browser-only; importing it under Node isn't supported. The self-contained scripts are also available to bundlers as `epubier/dist/epubier.min.js` and `epubier/dist/epubier.all.min.js`.

### TypeScript

Type declarations come with the package (`epubier.d.ts`, and `types/` for the other entry points): the options, the location passed to `onLocationChange`, the returned reader, whose `book` and `rendition` use epub.js's own types, and the format and session interfaces. Those bring in JSZip's, which refer to Node's types, so a project that type-checks libraries (`skipLibCheck: false`) also needs `@types/node`.

## API

### `epubier(element, path, opts?)`

Replaces `element` with the reader and opens the book at `path`: a URL, or the book's contents as an `ArrayBuffer` (for books held in IndexedDB, OPFS or a file input; with `epubier` itself, a `blob:` URL won't do, because epub.js tells ePubs apart by their `.epub` extension).

A reader with several formats (`epubier/all`, or `createEpubier()` with more than one) picks one by the `format` option, else the URL's extension, else the book's first bytes. With a URL that has no telling extension (a `blob:` URL, an API route), it fetches the book first to look. The reader keeps the element's id, classes and inline style. It fills the height it's given and has none of its own, so give the element (or its container) a height.

Options:

| Option          | Type                     | Description |
| --------------- | ------------------------ | ----------- |
| `onBackPressed` | `() => void`             | Shows a back button in the toolbar, which calls this. Without it there is no back button. |
| `styles`        | `Record<string, string>` | Theme overrides. See below. |
| `css`           | `string`                 | Extra CSS added to the page alongside the reader's own, for anything the theme doesn't cover. |
| `themes`        | `object \| false`        | Changes to the themes in the settings tab. See [Themes](#themes). |
| `theme`         | `string`                 | The theme to start with, until the reader chooses one. Default `"white"`. |
| `fonts`         | `object \| false`        | Changes to the fonts in the settings tab. See [Fonts](#fonts). |
| `font`          | `string`                 | The font to start with, until the reader chooses one. Default `"original"`, the book's own. |
| `immersive`     | `boolean`                | Whether phones and tablets held upright, and phones on their side, get the immersive layout, as in fullscreen. Default `true`. |
| `flow`          | `string`                 | Pages (`"paginated"`, the default) or one long scroll (`"scrolled"`), to start with until the reader chooses one. |
| `align`         | `string`                 | The text alignment to start with, until the reader chooses one: `"justify"` (default), `"left"`, `"right"` or `"original"`. |
| `textSize`      | `number`                 | The text size to start with, until the reader chooses one, as a percentage of the book's own: `70`, `80`, `90`, `100` (default), `110`, `120`, `135`, `150`, `175` or `200`. |
| `zoom`          | `number`                 | For PDFs and comics, the zoom to start with, until the reader chooses one, as a percentage of fitting the screen: `50`, `75`, `100` (default), `125`, `150`, `200`, `250`, `300` or `400`. |
| `storageKey`    | `string`                 | What the book's saved data is keyed by, instead of its URL. Required when `path` is an `ArrayBuffer`; use something stable, like a content hash. |
| `position`      | `string`                 | A location to open at (a CFI, or a page number for PDFs and comics; see `onLocationChange`), instead of the position saved in this browser, e.g. one kept by your own app. A `#loc` link in the URL still takes precedence. |
| `format`        | `string`                 | The book's format, `"epub"`, `"pdf"`, `"comic"` or `"mobi"`, when neither its URL nor its contents tell. Only matters to a reader with several formats. |
| `pdf`           | `object`                 | Where PDF.js finds its files: `{ workerSrc, assetsUrl }`. See [PDFs](#pdfs). |
| `replacements` | `"blobUrl" \| "base64"` | How pages refer to the book's images, styles and fonts when it's opened from a file or `ArrayBuffer`: blob URLs (default) or data URLs. Some Android WebViews take a fifth of a second per blob URL, which delays opening a book with many images. |
| `onLocationChange` | `(location) => void`  | Called whenever the position changes, with `{ location, progress, page, totalPages }`, and for ePubs `cfi` too. `location` is a CFI for ePubs and Kindle books, and the page number (as a string) for PDFs and comics; it's what `position` takes. `progress` (0–1) and the page numbers are `null` until the pages have been counted, and it's called again once they have. |
| `onThemeChange` | `(theme) => void` | Called with the theme in use when the reader opens and whenever one is chosen, with `{ id, background, dark }`: `background` is the reader's background color as computed, and `dark` whether it's dark. For matching the page around the reader to it. |

Returns `{ element, session, ready, book, rendition, destroy }`:

- `element`: the reader's root element.
- `session`: what shows the book (see [Custom formats](#custom-formats)), once it's open, e.g. `reader.session.metadata.then(m => document.title = m.title)`. Its `raw` has the format's own objects: `{ book, rendition }` for ePubs and Kindle books, `{ pdf }` (PDF.js's document) for PDFs, `{ zip }` for comics.
- `ready`: a promise of the session, once the book is open, or of `null` if it couldn't be opened. ePubs open straight away; the other formats have their code and the book to load first.
- `book`, `rendition`: the underlying epub.js objects, for ePubs (straight away) and Kindle books (once open), e.g. `reader.book.loaded.metadata.then(m => document.title = m.title)`.
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

## Formats

| Format | Entry point | Extensions | Library | Pages | Search | Highlights | Font & text settings |
| ------ | ----------- | ---------- | ------- | ----- | ------ | ---------- | -------------------- |
| ePub   | `epubier/formats/epub` | `.epub` | epub.js | ~1,500-character stretches | ✓ | ✓ | ✓ |
| Kindle | `epubier/formats/mobi` | `.mobi`, `.azw3`, `.azw` | `@lingo-reader/mobi-parser`, then epub.js | as ePub | ✓ | ✓ | ✓ |
| PDF    | `epubier/formats/pdf` | `.pdf` | `pdfjs-dist` | the PDF's pages | ✓ | | |
| Comic  | `epubier/formats/comic` | `.cbz` | JSZip (epub.js's dependency) | the images | | | |

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

A `.cbz` is a zip of images. Its pages are those images (JPEG, PNG, GIF, WebP, AVIF, BMP) in natural file name order (`page2` before `page10`), and when they're in several folders, each folder is a chapter. The title and writer come from a `ComicInfo.xml`, where there is one. Pages are laid out like a PDF's, sized by the first page's shape. `.cbr` (RAR) isn't supported.

### Kindle books

MOBI and KF8 (`.azw3`) books are parsed by `@lingo-reader/mobi-parser` and turned into an ePub in memory, which the reader then shows like any other: so they reflow, take the font and text settings, and can be searched and highlighted. The same book always turns into the same ePub, so saved positions and highlights stay put. Links within an older MOBI book go to the start of the chapter they point into. Books with DRM can't be opened.

### Custom formats

A format is an object, passed to `createEpubier()`:

```js
const myFormat = {
  id: "myformat",                 // for the `format` option, and saved data's keys
  extensions: ["xyz"],            // without the dot
  test: (bytes) => /* is this Uint8Array (the first 1024 bytes) one of these? */,
  load: () => import("./my-session.js"), // or `open` itself, to have it straight away
};
```

`open(viewer, input, ctx)` shows the book (`input`: a URL, or an `ArrayBuffer`) in `viewer`, and returns a session (or a promise of one): an object that turns pages, reports where it is, and says what it can do. `EpubierSession` in `epubier.d.ts` describes it, and `src/formats/paged.js` makes one for books of fixed pages, given how to draw a page, as the PDF and comic formats do (with pages and a scroll both). A session with `setFlow` gets the Layout setting, and starts as `ctx.flow`; one with `setZoom` gets the Zoom setting.

## Things to know

- **The URL hash.** The reader keeps `#loc=<page>` (and `&hl=<passage>` for shared passages) in `location.hash`, replacing the history entry rather than adding one, and follows those links when the page opens or the hash changes. Don't use the hash for anything else on the same page.
- **Saved data.** Reading position, page counts, bookmarks and highlights go in `localStorage`, keyed by the book's format and URL (or `storageKey`): `epub-position:<url>` and so on, `pdf-…` for a PDF. They stay in that browser, and are lost if the key changes. The theme, layout, font, text size and alignment chosen in the settings are saved for all books (`epubier-theme`, `epubier-flow`, `epubier-font`, `epubier-text-size`, `epubier-align`, and `epubier-zoom` for PDFs and comics).
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
- `src/formats/`: the formats. `epub/` (with `patches.js`, fixes to epub.js applied to its classes when it loads), `mobi/` (turns Kindle books into ePubs), `pdf/` and `comic/` (both through `paged.js`, for books of fixed pages)
- `src/template.js`, `src/icons.js`: markup
- `src/themes.js`, `src/fonts.js`: the built-in themes and fonts
- `src/styles.js`: the stylesheet and theme overrides
- `src/storage.js`, `src/share.js`: localStorage and sharing helpers

## Publishing

`npm publish` builds first (`prepublishOnly`). `npm pack --dry-run` lists what goes in the package: `dist/`, `src/`, `epubier.d.ts`, `types/`, the licenses and this README.

## License

[MIT](LICENSE). `epubier.min.js` also contains epub.js (BSD-2-Clause), JSZip (used under MIT), localforage (Apache-2.0) and smaller MIT/ISC packages; `epubier.all.min.js` adds PDF.js (Apache-2.0), mobi-parser and fflate (MIT) and sax (BlueOak-1.0.0). The build finds them from what esbuild actually bundled, writes their licenses to [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES), and puts each file's at its top, so shipping that one file meets every license. `pdf.worker.min.mjs` is PDF.js's own, with its license at its top. The ES modules in `dist/esm/` bundle none of them and carry only epubier's license and the epub.js notice.
