// localStorage that never throws (private mode, blocked storage) and reads JSON safely.
export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode: nothing to keep */ }
  },
  json(key, fallback) {
    try { return JSON.parse(this.get(key, '')) ?? fallback; } catch (e) { return fallback; }
  },
  setJson(key, value) { this.set(key, JSON.stringify(value)); },
};
