# epubier

A drop-in ePub reader UI built on [epub.js](https://github.com/futurepress/epub.js). It adds:

- one- or two-page layout, chosen by the space available
- a table of contents, the current chapter, page numbers and a progress slider
- search across the whole book
- bookmarks and colored highlights, saved in the browser
- links to a page or a passage, shared through the system share sheet on phones or copied to the clipboard elsewhere
- a fullscreen mode, with swipes and tap zones for turning pages
- settings for the page color (white, sepia, dark sepia or black), the font, the text size and the text alignment
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
| `themes`        | `object \| false`        | Changes to the themes in the settings tab. See [Themes](#themes). |
| `theme`         | `string`                 | The theme to start with, until the reader chooses one. Default `"white"`. |
| `fonts`         | `object \| false`        | Changes to the fonts in the settings tab. See [Fonts](#fonts). |
| `font`          | `string`                 | The font to start with, until the reader chooses one. Default `"original"`, the book's own. |
| `align`         | `string`                 | The text alignment to start with, until the reader chooses one: `"justify"` (default), `"left"`, `"right"` or `"original"`. |
| `textSize`      | `number`                 | The text size to start with, until the reader chooses one, as a percentage of the book's own: `70`, `80`, `90`, `100` (default), `110`, `120`, `135`, `150`, `175` or `200`. |

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

## Things to know

- **The URL hash.** The reader keeps `#loc=<page>` (and `&hl=<passage>` for shared passages) in `location.hash`, replacing the history entry rather than adding one, and follows those links when the page opens or the hash changes. Don't use the hash for anything else on the same page.
- **Saved data.** Reading position, page counts, bookmarks and highlights go in `localStorage`, keyed by the book's URL. They stay in that browser, and are lost if the book's URL changes. The theme, font, text size and alignment chosen in the settings are saved for all books (`epubier-theme`, `epubier-font`, `epubier-text-size`, `epubier-align`).
- **Changing the font, text size or alignment** reflows the book and keeps the same passage on screen.
- **Text size** scales the book's root font size, which works for books that size their text in `em`, `rem` or `%` (nearly all). Text sized in `px` stays as it is.
- **Text alignment** applies to the book's ordinary paragraphs, the ones aligned to the start or justified. Anything the book centers or aligns to the other side, like headings and title pages, keeps its alignment. Justified text is hyphenated where the browser can.
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
- `src/themes.js`, `src/fonts.js`: the built-in themes and fonts
- `src/styles.js`: the stylesheet and theme overrides
- `src/storage.js`, `src/share.js`: localStorage and sharing helpers

## License

[MIT](LICENSE). `epubier.min.js` also contains epub.js (BSD-2-Clause), JSZip (used under MIT), localforage (Apache-2.0) and smaller MIT/ISC packages. The build finds them from what esbuild actually bundled, writes their licenses to [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES), and puts all of it at the top of `epubier.min.js`, so shipping that one file meets every license. `epubier.esm.js` bundles none of them and carries only epubier's license and the epub.js notice.
