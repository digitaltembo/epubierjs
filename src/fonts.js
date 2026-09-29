const googleFonts = (family) => `https://fonts.googleapis.com/css2?family=${family}&display=swap`;

/**
 * Built-in fonts, in the order the settings tab lists them. `family` is a
 * CSS font-family for the book's text; `url` is a stylesheet that provides
 * it, loaded only when the font is chosen (and, for the settings tab's
 * preview, just the letters of its name). "Original" leaves the book's own
 * fonts alone.
 */
export const BUILT_IN_FONTS = {
  original: { label: "Original" },
  literata: {
    label: "Literata",
    family: '"Literata", serif',
    url: googleFonts("Literata:ital,wght@0,400;0,700;1,400;1,700"),
  },
  lora: {
    label: "Lora",
    family: '"Lora", serif',
    url: googleFonts("Lora:ital,wght@0,400;0,700;1,400;1,700"),
  },
  garamond: {
    label: "EB Garamond",
    family: '"EB Garamond", serif',
    url: googleFonts("EB+Garamond:ital,wght@0,400;0,700;1,400;1,700"),
  },
  sourceSans: {
    label: "Source Sans",
    family: '"Source Sans 3", sans-serif',
    url: googleFonts("Source+Sans+3:ital,wght@0,400;0,700;1,400;1,700"),
  },
  atkinson: {
    label: "Atkinson Hyperlegible",
    family: '"Atkinson Hyperlegible", sans-serif',
    url: googleFonts("Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700"),
  },
};

export const DEFAULT_FONT = "original";

/** Stylesheet for previewing `font` in the settings tab */
export function previewUrl(font) {
  if (!font.url) return null;
  // Google Fonts can send just the glyphs needed to show the name
  if (font.url.startsWith("https://fonts.googleapis.com/")) {
    return `${font.url}&text=${encodeURIComponent(font.label)}`;
  }
  return font.url;
}

/**
 * Built-in fonts with `custom` applied, the same way as themes: an entry
 * for a built-in font changes the values it gives, `null` removes a font,
 * and other names add fonts. `false` removes them all.
 *
 * @returns {Record<string, {label: string, family?: string, url?: string}>}
 */
export function resolveFonts(custom = {}) {
  if (custom === false) return {};
  const fonts = {};
  for (const id of new Set([...Object.keys(BUILT_IN_FONTS), ...Object.keys(custom)])) {
    if (custom[id] === null) continue;
    const { label = id, family, url } = { ...BUILT_IN_FONTS[id], ...custom[id] };
    fonts[id] = { label, family, url };
  }
  return fonts;
}
