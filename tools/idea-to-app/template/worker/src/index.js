// __APP_NAME__ on Cloudflare: the site (static assets) plus the API.
//   GET  /v1/s/:id  → { iv, data, updatedAt } | 404 | 410 when the key was revoked
//   PUT  /v1/s/:id  ← { iv, data, updatedAt, auth } → { updatedAt } | 409 { updatedAt } when the stored copy is newer
//                     | 403 when auth doesn't match the one the first write set | 410 after DELETE
//   DELETE /v1/s/:id ← { auth } → 204   revokes the key for good: data is erased, every device on it gets 410
//   POST /v1/hello  ← { id } (random per browser) → { users }   counts a browser once
//   GET  /v1/stats  → { users }
// :id is SHA-256(sync key) in hex; data is encrypted on the device. No listing endpoint exists.
// Knowing :id is enough to read the ciphertext but not to write: writes need auth (another hash of the key),
// stored only as SHA-256(auth), so the id seen in logs can't be used to wipe or lock someone's data.
// Writes and the counter are rate-limited per IP (the RATE_LIMIT binding, when present).
// On the real domain: http → https, HSTS and security headers on every page.

const MAX_BODY = 64 * 1024;
const DAY = 86_400_000;
const EXPIRE_AFTER = 365 * DAY;

const sha256hex = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))]
    .map(b => b.toString(16).padStart(2, "0")).join("");

// true when this IP may make another write; without the binding (tests, local dev) always true
async function allowed(req, env) {
  if (!env.RATE_LIMIT) return true;
  const ip = req.headers.get("CF-Connecting-IP") || "unknown";
  try { return (await env.RATE_LIMIT.limit({ key: ip })).success; } catch { return true; }
}

function corsHeaders(req, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

// set at deploy time (wrangler --var APP_VERSION:<git sha>); lets the deploy check wait for the new version
let appVersion = "dev";

const json = (body, status, headers, cache = "no-store") =>
  new Response(JSON.stringify(body), {
    status, headers: {
      ...headers, "Content-Type": "application/json", "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff", "X-App-Version": appVersion,
    },
  });

// Only what the page actually loads: its own files and Google Fonts. Add hosts here when you add services
// (and prefer self-hosting third-party scripts: anything in script-src can read the sync key in localStorage).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

function withSecurityHeaders(res, https) {
  const h = new Headers(res.headers);
  if (https) h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("Content-Security-Policy", CSP);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  h.set("X-App-Version", appVersion);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// The first write for an id sets its write token (stored as SHA-256); later writes must bring the same one.
// Setups written before tokens existed get theirs from the next write. → "ok" | "forbidden" | "revoked"
async function checkAuth(env, id, auth) {
  const authHash = await sha256hex(auth);
  await env.DB.prepare("INSERT OR IGNORE INTO sync_auth (id, auth) VALUES (?, ?)").bind(id, authHash).run();
  const row = await env.DB.prepare("SELECT auth, revoked_at FROM sync_auth WHERE id = ?").bind(id).first();
  if (row?.auth !== authHash) return "forbidden";
  return row.revoked_at ? "revoked" : "ok";
}

async function usersTotal(env) {
  const row = await env.DB.prepare("SELECT value FROM counters WHERE name = 'users'").first();
  return row?.value ?? 0;
}

export default {
  async fetch(req, env) {
    appVersion = env.APP_VERSION || "dev";
    const url = new URL(req.url);
    const host = env.CANONICAL_HOST;
    const onDomain = host && (url.hostname === host || url.hostname === `www.${host}`);
    // http → https and www → bare domain, in one hop
    if (onDomain && (url.protocol === "http:" || url.hostname !== host)) {
      url.protocol = "https:";
      url.hostname = host;
      return Response.redirect(url.toString(), 301);
    }
    // everything outside the API is the site
    if (!url.pathname.startsWith("/v1/")) {
      const res = env.ASSETS ? await env.ASSETS.fetch(req) : new Response("Not found", { status: 404 });
      return withSecurityHeaders(res, url.protocol === "https:");
    }

    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (url.pathname === "/v1/stats" && req.method === "GET") {
      return json({ users: await usersTotal(env) }, 200, cors, "public, max-age=300");
    }
    if (url.pathname === "/v1/hello" && req.method === "POST") {
      if (!(await allowed(req, env))) return json({ error: "rate_limited" }, 429, cors);
      let body;
      try { body = JSON.parse((await req.text()).slice(0, 200)); } catch { return json({ error: "bad_json" }, 400, cors); }
      if (typeof body?.id !== "string" || !/^[0-9a-f]{32}$/.test(body.id)) return json({ error: "bad_request" }, 400, cors);
      const r = await env.DB.prepare("INSERT OR IGNORE INTO visitors (id, first_seen) VALUES (?, ?)").bind(body.id, Date.now()).run();
      if (r.meta.changes) await env.DB.prepare("UPDATE counters SET value = value + 1 WHERE name = 'users'").run();
      return json({ users: await usersTotal(env) }, 200, cors);
    }

    const m = url.pathname.match(/^\/v1\/s\/([0-9a-f]{64})$/);
    if (!m) return json({ error: "not_found" }, 404, cors);
    const id = m[1];

    if (req.method === "GET") {
      const row = await env.DB.prepare("SELECT iv, data, updated_at FROM sync WHERE id = ?").bind(id).first();
      if (!row) {
        const gone = await env.DB.prepare("SELECT 1 FROM sync_auth WHERE id = ? AND revoked_at IS NOT NULL").bind(id).first();
        return gone ? json({ error: "revoked" }, 410, cors) : json({ error: "not_found" }, 404, cors);
      }
      return json({ iv: row.iv, data: row.data, updatedAt: row.updated_at }, 200, cors);
    }

    if (req.method === "PUT") {
      if (Number(req.headers.get("Content-Length")) > MAX_BODY) return json({ error: "too_large" }, 413, cors);
      if (!(await allowed(req, env))) return json({ error: "rate_limited" }, 429, cors);
      const text = await req.text();
      if (text.length > MAX_BODY) return json({ error: "too_large" }, 413, cors);
      let body;
      try { body = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400, cors); }
      const { iv, data, updatedAt, auth } = body || {};
      const now = Date.now();
      if (typeof iv !== "string" || !/^[A-Za-z0-9+/]{1,32}={0,2}$/.test(iv)
        || typeof data !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)
        || typeof auth !== "string" || !/^[0-9a-f]{64}$/.test(auth)
        || !Number.isSafeInteger(updatedAt) || updatedAt <= 0 || updatedAt > now + DAY) {
        return json({ error: "bad_request" }, 400, cors);
      }
      // the first write for an id sets its write token; later writes must bring the same one
      const owner = await checkAuth(env, id, auth);
      if (owner === "revoked") return json({ error: "revoked" }, 410, cors);
      if (owner !== "ok") return json({ error: "forbidden" }, 403, cors);
      // last write wins: only replace an older copy
      const res = await env.DB.prepare(
        `INSERT INTO sync (id, iv, data, updated_at, written_at) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET iv = excluded.iv, data = excluded.data,
           updated_at = excluded.updated_at, written_at = excluded.written_at
         WHERE excluded.updated_at > sync.updated_at`,
      ).bind(id, iv, data, updatedAt, now).run();
      if (!res.meta.changes) {
        const cur = await env.DB.prepare("SELECT updated_at FROM sync WHERE id = ?").bind(id).first();
        return json({ error: "stale", updatedAt: cur?.updated_at ?? 0 }, 409, cors);
      }
      return json({ updatedAt }, 200, cors);
    }

    if (req.method === "DELETE") {
      if (!(await allowed(req, env))) return json({ error: "rate_limited" }, 429, cors);
      let body;
      try { body = JSON.parse((await req.text()).slice(0, 200)); } catch { return json({ error: "bad_json" }, 400, cors); }
      if (typeof body?.auth !== "string" || !/^[0-9a-f]{64}$/.test(body.auth)) return json({ error: "bad_request" }, 400, cors);
      if ((await checkAuth(env, id, body.auth)) === "forbidden") return json({ error: "forbidden" }, 403, cors);
      // keep a tombstone so devices still on this key can't bring the data back
      await env.DB.prepare("UPDATE sync_auth SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?").bind(Date.now(), id).run();
      await env.DB.prepare("DELETE FROM sync WHERE id = ?").bind(id).run();
      return new Response(null, { status: 204, headers: { ...cors, "Cache-Control": "no-store" } });
    }

    return json({ error: "method_not_allowed" }, 405, cors);
  },

  async scheduled(_event, env) {
    await env.DB.prepare("DELETE FROM sync WHERE written_at < ?").bind(Date.now() - EXPIRE_AFTER).run();
    // tokens of expired setups go with them; tombstones of revoked keys are kept for the same year
    await env.DB.prepare(
      "DELETE FROM sync_auth WHERE id NOT IN (SELECT id FROM sync) AND (revoked_at IS NULL OR revoked_at < ?)",
    ).bind(Date.now() - EXPIRE_AFTER).run();
  },
};
