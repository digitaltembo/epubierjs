import defaults from "./strings.json";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** `base` with `custom` merged into it, object by object */
function merge(base, custom) {
  if (!isObject(custom)) return custom === undefined ? base : custom;
  const merged = { ...base };
  for (const [key, value] of Object.entries(custom)) {
    merged[key] = isObject(base?.[key]) ? merge(base[key], value) : value;
  }
  return merged;
}

/** `text` with each `{name}` in it replaced by `vars.name` */
export function fill(text, vars = {}) {
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/**
 * The reader's text, from strings.json with `custom` merged into it: a
 * function that looks up a dotted key (`"search.results"`) and fills in
 * `vars`. A string that varies by number is an object of plural forms,
 * keyed by Intl.PluralRules category ("one", "few", "other", …) for the
 * strings' `locale`, chosen by `vars.count`.
 *
 * @param {object} [custom] Overrides, shaped like strings.json
 * @returns {((key: string, vars?: object) => string) & {get: (key: string) => any, error: (error: any) => string}}
 */
export function translator(custom) {
  const strings = merge(defaults, custom);
  let plurals;
  try {
    plurals = new Intl.PluralRules(strings.locale);
  } catch (e) {
    plurals = new Intl.PluralRules("en");
  }

  const get = (key) => key.split(".").reduce((value, part) => (isObject(value) ? value[part] : undefined), strings);

  function t(key, vars) {
    let value = get(key);
    if (isObject(value)) value = value[plurals.select(vars?.count ?? 0)] ?? value.other;
    return typeof value === "string" ? fill(value, vars) : key;
  }
  t.get = get;
  /** An error's message, in these strings when it's one of the reader's own (see bookError) */
  t.error = (error) =>
    error?.code && typeof get(`errors.${error.code}`) === "string"
      ? t(`errors.${error.code}`, error.vars)
      : String(error?.message || error);
  return t;
}

/**
 * An error the reader shows: `code` is its key in strings.json's `errors`,
 * which the reader shows it in, in whatever language it's been given; its
 * message is the English one, for the console.
 */
export function bookError(code, vars) {
  const error = new Error(fill(defaults.errors[code], vars));
  error.code = code;
  if (vars) error.vars = vars;
  return error;
}
