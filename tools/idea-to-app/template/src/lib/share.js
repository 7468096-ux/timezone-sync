/* ── share links and codes ──
   A link is SITE#s.<base64url(JSON)>; the same "s.…" string is the "code" used where links can't work
   (inside the Claude artifact). Everything decoded goes through sanitize — a broken or hostile link
   must never break the app or get saved. For big states, design a compact app-specific format and keep
   decoding every older format forever (links live in chats for years). */
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64url(str) {
  let bin = "";
  for (const b of enc.encode(str)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64url(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return dec.decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
}

export const encodeShare = (state) => "s." + toB64url(JSON.stringify(state));

// → sanitized state | null (not a share code) | "invalid" (looks like one but is damaged)
export function decodeShare(raw, sanitize) {
  const s = String(raw || "").trim();
  const m = s.match(/(?:^|#)s\.(\S*)/);
  if (!m) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(m[1])) return "invalid";
  try { return sanitize(JSON.parse(fromB64url(m[1]))) || "invalid"; } catch { return "invalid"; }
}

export const shareLink = (state, base) =>
  `${base || (window.location.origin + window.location.pathname)}#${encodeShare(state)}`;
