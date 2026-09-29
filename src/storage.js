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

/** Storage keys for one book, shared with pages that used the reader before it was a library */
export const storageKeys = (url) => ({
  position: "epub-position:" + url,
  locations: "epub-locations:" + url,
  annotations: "epub-annotations:" + url,
});
