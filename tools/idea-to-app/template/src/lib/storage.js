/* ── safe localStorage: private windows, blocked storage and quota errors never crash the app ── */
import { APP_SLUG } from "./config.js";

const k = (name) => `${APP_SLUG}-${name}`;

export function load(name, fallback = null) {
  try {
    const raw = localStorage.getItem(k(name));
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

export function save(name, value) {
  try {
    if (value == null) localStorage.removeItem(k(name));
    else localStorage.setItem(k(name), JSON.stringify(value));
  } catch {}
}

// Reads the hash and removes it right away, so a reload doesn't re-apply a link over later edits.
export function takeHash() {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.slice(1);
  if (hash) { try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch {} }
  return hash;
}

// Clipboard can fail (http, old browsers, iframes): caller shows the text for manual copy on false
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
