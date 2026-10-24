/**
 * localStorage, treated as a convenience only: it may be unavailable
 * (private browsing, blocked site data), in which case nothing is saved.
 */
export const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  },
  getJSON(key) {
    try {
      return JSON.parse(this.get(key));
    } catch (e) {
      return null;
    }
  },
  setJSON(key, value) {
    this.set(key, JSON.stringify(value));
  },
};

/**
 * Storage keys for one book, prefixed with its format's id. An ePub's are
 * shared with pages that used the reader before it was a library.
 */
export const storageKeys = (url, format = "epub") => ({
  position: `${format}-position:${url}`,
  locations: `${format}-locations:${url}`,
  annotations: `${format}-annotations:${url}`,
});
