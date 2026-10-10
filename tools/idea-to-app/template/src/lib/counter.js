/* ── user counter: each browser is counted once, anonymously ──
   A random id is made on the device (no names, no IP, no cookies) and sent once;
   later visits only read the total. Works wherever the sync API is available. */
import { SYNC_ENABLED, SYNC_URL } from "./sync.js";
import { APP_SLUG } from "./config.js";

const LS_ID = `${APP_SLUG}-visitor`;
const LS_COUNTED = `${APP_SLUG}-visitor-counted`;

function visitorId() {
  try {
    let id = localStorage.getItem(LS_ID);
    if (!/^[0-9a-f]{32}$/.test(id || "")) {
      id = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(LS_ID, id);
    }
    return { id, counted: localStorage.getItem(LS_COUNTED) === "1" };
  } catch { return null; } // no storage: read the total, don't count
}

// → number of users, or null when unknown (offline, no API in this build)
export async function fetchUsers() {
  if (!SYNC_ENABLED) return null;
  const me = visitorId();
  try {
    const res = me && !me.counted
      ? await fetch(`${SYNC_URL}/v1/hello`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: me.id }),
        })
      : await fetch(`${SYNC_URL}/v1/stats`);
    if (!res.ok) return null;
    if (me && !me.counted) { try { localStorage.setItem(LS_COUNTED, "1"); } catch {} }
    const { users } = await res.json();
    return Number.isSafeInteger(users) && users > 0 ? users : null;
  } catch { return null; }
}
