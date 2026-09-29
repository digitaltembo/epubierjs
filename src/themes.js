import { styleProperties } from "./styles.js";

/**
 * Built-in themes, in the order the settings tab lists them. A theme sets
 * any of the `styles` names on top of `styles`; White sets nothing, so it's
 * the reader's default look (as adjusted by `styles`). `dark` says whether
 * the page is dark, which changes how highlights are blended; when it's
 * left out it's worked out from the page color.
 */
export const BUILT_IN_THEMES = {
  black: {
    label: "Black",
    dark: true,
    background: "#111",
    page: "#000",
    text: "#d6d6d6",
    muted: "#8c8c8c",
    border: "#333",
    accent: "#e0b56f",
  },
  sepiaDark: {
    label: "Sepia dark",
    dark: true,
    background: "#1c1813",
    page: "#2a241c",
    text: "#e4d6bb",
    muted: "#a6977b",
    border: "#4a4032",
    accent: "#dca55a",
  },
  sepiaLight: {
    label: "Sepia light",
    dark: false,
    background: "#e8dcc2",
    page: "#f6ecd6",
    text: "#40311f",
    muted: "#77654b",
    border: "#d2c09c",
  },
  white: {
    label: "White",
    dark: false,
  },
};

export const DEFAULT_THEME = "white";

/**
 * Built-in themes with `custom` applied: an entry for a built-in theme
 * changes just the values it gives, `null` removes a theme, and any other
 * name adds one (listed after the built-in ones). `false` removes them all.
 *
 * @returns {Record<string, {label: string, dark?: boolean, properties: [string, string][]}>}
 */
export function resolveThemes(custom = {}) {
  if (custom === false) return {};
  const themes = {};
  for (const id of new Set([...Object.keys(BUILT_IN_THEMES), ...Object.keys(custom)])) {
    if (custom[id] === null) continue;
    const { label = id, dark, ...styles } = { ...BUILT_IN_THEMES[id], ...custom[id] };
    themes[id] = { label, dark, properties: styleProperties(styles) };
  }
  return themes;
}
