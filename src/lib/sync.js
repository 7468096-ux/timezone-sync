/* ── device sync: one secret key per person, shared by their devices ──
   The key never leaves the devices in clear: the server sees id = SHA-256("tz-sync:id:" + key)
   and AES-GCM ciphertext encrypted with SHA-256("tz-sync:enc:" + key). */

// VITE_SYNC_URL: "" → sync off, "/" → API on the site's own domain, "https://…" → separate service
const RAW_SYNC_URL = import.meta.env?.VITE_SYNC_URL || "";
export const SYNC_ENABLED = !!RAW_SYNC_URL;
export const SYNC_URL = RAW_SYNC_URL.replace(/\/+$/, "");
const LS_KEY = "tz-sync-device-key";
const LS_META = "tz-sync-device-meta"; // { localAt, remoteAt, syncedAt }

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64url = (bytes) => toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

// 128-bit random key, 22 url-safe characters
export function newKey() {
  return b64url(crypto.getRandomValues(new Uint8Array(16)));
}

export const isKey = (s) => typeof s === "string" && /^[A-Za-z0-9_-]{22}$/.test(s);

// Accepts the bare key, "#sync.KEY" or a full link containing it
export function parseKey(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/sync\.([A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])/);
  if (m) return m[1];
  return isKey(s) ? s : null;
}

export const keyLink = (key) =>
  `${window.location.origin}${window.location.pathname}#sync.${key}`;

async function derive(key) {
  const id = hex(await crypto.subtle.digest("SHA-256", enc.encode(`tz-sync:id:${key}`)));
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`tz-sync:enc:${key}`));
  const aes = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return { id, aes };
}

export async function encryptPayload(key, payload) {
  const { aes } = await derive(key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, enc.encode(JSON.stringify(payload)));
  return { iv: toB64(iv), data: toB64(data) };
}

export async function decryptPayload(key, { iv, data }) {
  const { aes } = await derive(key);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, aes, fromB64(data));
  return JSON.parse(dec.decode(plain));
}

/* ── HTTP ── */
// → { found: false } | { found: true, updatedAt, payload }
export async function pull(key, base = SYNC_URL) {
  const { id } = await derive(key);
  const res = await fetch(`${base}/v1/s/${id}`, { cache: "no-store" });
  if (res.status === 404) return { found: false };
  if (!res.ok) throw new Error(`sync ${res.status}`);
  const body = await res.json();
  return { found: true, updatedAt: body.updatedAt, payload: await decryptPayload(key, body) };
}

// → { ok: true } | { ok: false, stale: true, updatedAt }
export async function push(key, payload, updatedAt, base = SYNC_URL) {
  const { id } = await derive(key);
  const body = { ...(await encryptPayload(key, payload)), updatedAt };
  const res = await fetch(`${base}/v1/s/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (res.status === 409) return { ok: false, stale: true, updatedAt: (await res.json()).updatedAt };
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return { ok: true };
}

/* ── local state ── */
export function loadKey() {
  try { const k = localStorage.getItem(LS_KEY); return isKey(k) ? k : null; } catch { return null; }
}
export function saveKey(key) {
  try { key ? localStorage.setItem(LS_KEY, key) : localStorage.removeItem(LS_KEY); } catch {}
}
export function loadMeta() {
  try { return { localAt: 0, remoteAt: 0, syncedAt: 0, ...JSON.parse(localStorage.getItem(LS_META) || "{}") }; }
  catch { return { localAt: 0, remoteAt: 0, syncedAt: 0 }; }
}
export function saveMeta(meta) {
  try { meta ? localStorage.setItem(LS_META, JSON.stringify(meta)) : localStorage.removeItem(LS_META); } catch {}
}
