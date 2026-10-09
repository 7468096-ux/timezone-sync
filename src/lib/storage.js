/* ── persistence + share-link intake, shared by both UI versions ── */
import { isValidTZ } from "./time.js";
import { DEFAULTS, normalizeTZ, sanitizePeople, encodeConfig, decodeConfig } from "./config.js";

const LS_PEOPLE = "tz-sync-people";
const LS_REF = "tz-sync-ref";
const LS_BACKUP = "tz-sync-people-backup";

// Build for the Claude artifact viewer: its page URL isn't shareable, so "share"
// copies a config code and an "import code" field replaces opening links.
export const EMBED = import.meta.env?.MODE === "artifact";

function readSaved() {
  try { return sanitizePeople(JSON.parse(localStorage.getItem(LS_PEOPLE))); } catch { return null; }
}

export function savePeople(people) {
  try { localStorage.setItem(LS_PEOPLE, JSON.stringify(people)); } catch {}
}

// Reads the config from the URL hash and removes the hash, so that a reload
// doesn't throw away edits made after opening a shared link.
/* ── moving from the old address ──
   The old site (github.io) can't share localStorage with the new domain, so it forwards its data once
   as "#migrate.<base64url JSON {p: people, r: refTZ, l: lang, k: sync key, m: sync meta}>".
   It is applied only if this browser has nothing saved here yet, so it never overwrites newer data.
   Must run before anything reads localStorage (call at the top of the app module). */
export function consumeMigration() {
  const hash = window.location.hash.slice(1);
  if (!hash.startsWith("migrate.")) return false;
  try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch {}
  try {
    if (localStorage.getItem(LS_PEOPLE)) return false;
    const b64 = hash.slice(8).replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
    const d = JSON.parse(json);
    const people = sanitizePeople(d.p);
    if (people) localStorage.setItem(LS_PEOPLE, JSON.stringify(people));
    if (typeof d.r === "string" && isValidTZ(normalizeTZ(d.r))) localStorage.setItem(LS_REF, normalizeTZ(d.r));
    if (typeof d.l === "string" && /^[a-z]{2}$/.test(d.l)) localStorage.setItem("tz-sync-lang", d.l);
    if (typeof d.k === "string" && /^[A-Za-z0-9_-]{22}$/.test(d.k)) {
      localStorage.setItem("tz-sync-device-key", d.k);
      if (d.m && typeof d.m === "object") localStorage.setItem("tz-sync-device-meta", JSON.stringify(d.m));
    }
    return true;
  } catch { return false; }
}

// Returns null (no hash), "invalid" (broken link), { sync: key } (device-sync link) or the people list.
export function takeHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch {}
  const sync = hash.match(/^sync\.([A-Za-z0-9_-]{22})$/);
  if (sync) return { sync: sync[1] };
  return decodeConfig(hash) || "invalid";
}

// Accepts a bare code or a full link; returns the people list or "invalid"
export function parseCode(raw) {
  const s = raw.trim();
  return decodeConfig(s.includes("#") ? s.slice(s.indexOf("#") + 1) : s) || "invalid";
}

export const sameConfig = (a, b) => encodeConfig(a) === encodeConfig(b);

export function rememberBackup(people) {
  try { localStorage.setItem(LS_BACKUP, JSON.stringify(people)); } catch {}
}

// Call once at module scope (outside StrictMode's double-invoked initializers).
// makeDefaults: optional () => people for first-time visitors (v1 uses its built-in example)
export function loadInitial(makeDefaults = () => DEFAULTS) {
  const saved = readSaved();
  const fromLink = takeHash();
  const fallback = () => saved || sanitizePeople(makeDefaults()) || DEFAULTS;
  if (fromLink === "invalid") return { people: fallback(), notice: { kind: "badlink" } };
  if (fromLink?.sync) return { people: fallback(), notice: { kind: "sync", key: fromLink.sync } };
  if (fromLink) {
    const backup = saved && !sameConfig(saved, fromLink) ? saved : null;
    if (backup) rememberBackup(backup);
    return { people: fromLink, notice: { kind: "link", backup } };
  }
  return { people: fallback(), notice: null };
}

export const detectTZ = () => {
  try { return normalizeTZ(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { return "UTC"; }
};

// Saved choice wins; otherwise the browser's zone (so it follows you when travelling)
export function loadRefTZ() {
  try {
    const saved = normalizeTZ(localStorage.getItem(LS_REF) || "");
    if (isValidTZ(saved)) return saved;
  } catch {}
  const d = detectTZ();
  return isValidTZ(d) ? d : "UTC";
}

export function saveRefTZ(tz) {
  try { localStorage.setItem(LS_REF, tz); } catch {}
}

export const nextId = (people) => Math.max(0, ...people.map(p => p.id)) + 1;
