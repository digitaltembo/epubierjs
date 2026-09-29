# epubier

A drop-in ePub reader UI built on [epub.js](https://github.com/futurepress/epub.js). It adds:

- one- or two-page layout, chosen by the space available
- a table of contents, the current chapter, page numbers and a progress slider
- search across the whole book
- bookmarks and colored highlights, saved in the browser
- links to a page or a passage, shared through the system share sheet on phones or copied to the clipboard elsewhere
- a fullscreen mode, with swipes and tap zones for turning pages
- the reading position in the URL (`#loc=42`), so links and reloads come back to the same place

## Usage

### Script tags

```html
<script src="epubier.min.js"></script>

<div id="reader" style="height: 100vh"></div>
<script>
  const reader = epubier(document.getElementById("reader"), "books/moby-dick.epub", {
    onBackPressed: () => history.back(),
    styles: { accent: "#1d4ed8" },
  });
</script>
```

`epubier.min.js` is self-contained: it includes epub.js, JSZip and their dependencies (about 420kb minified, 120kb gzipped).

### Bundlers

```js
import epubier from "epubier"; // epubjs comes with it as a dependency

epubier(element, "books/moby-dick.epub");
```

## API

### `epubier(element, path, opts?)`

Replaces `element` with the reader and opens the ePub at `path` (a URL). The reader keeps the element's id, classes and inline style. It fills the height it's given and has none of its own, so give the element (or its container) a height.

Options:

| Option          | Type                     | Description |
| --------------- | ------------------------ | ----------- |
| `onBackPressed` | `() => void`             | Shows a back button in the toolbar, which calls this. Without it there is no back button. |
| `styles`        | `Record<string, string>` | Theme overrides. See below. |
| `css`           | `string`                 | Extra CSS added to the page alongside the reader's own, for anything the theme doesn't cover. |

Returns `{ element, book, rendition, destroy }`:

- `element`: the reader's root element.
- `book`, `rendition`: the underlying epub.js objects, e.g. `reader.book.loaded.metadata.then(m => document.title = m.title)`.
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

These style the reader's UI. The book's own text is styled by the book. The variables can also be set from your own CSS, e.g. `#reader { --ep-accent: crimson; }`. For anything else, the reader's classes all start with `ep-` under a `.epubier` root.

## Things to know

- **The URL hash.** The reader keeps `#loc=<page>` (and `&hl=<passage>` for shared passages) in `location.hash`, replacing the history entry rather than adding one, and follows those links when the page opens or the hash changes. Don't use the hash for anything else on the same page.
- **Saved data.** Reading position, page counts, bookmarks and highlights go in `localStorage`, keyed by the book's URL. They stay in that browser, and are lost if the book's URL changes.
- **Page numbers** are fixed ~1,500-character stretches of text, so they're the same on any screen. They're counted the first time a book is opened (a few seconds; a spinner shows meanwhile) and cached after that.
- **Keyboard:** ←/→ and PageUp/PageDown turn pages, `B` bookmarks, `F` toggles fullscreen, Esc closes menus and panels.
- **Fullscreen** covers the window and uses the browser's fullscreen mode where it's available (not on iPhone). In fullscreen, tap the left or right third to turn pages and the middle to show the controls.

## Development

```sh
npm install
npm run build   # dist/epubier.min.js (+ .map) and dist/epubier.esm.js
npm start       # rebuilds on change and serves http://localhost:8000/example/
```

The example opens `example/book.epub`, or another book with `?book=path/to/book.epub`.

Source layout:

- `src/index.js`: the `epubier()` entry point
- `src/reader.js`: the reader's behaviour
- `src/template.js`, `src/icons.js`: markup
- `src/styles.js`: the stylesheet and theme overrides
- `src/storage.js`, `src/share.js`: localStorage and sharing helpers

## License

[MIT](LICENSE). `epubier.min.js` also contains epub.js (BSD-2-Clause), JSZip (used under MIT), localforage (Apache-2.0) and smaller MIT/ISC packages. The build finds them from what esbuild actually bundled, writes their licenses to [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES), and puts all of it at the top of `epubier.min.js`, so shipping that one file meets every license. `epubier.esm.js` bundles none of them and carries only epubier's license and the epub.js notice.
