// Timezone Sync on Cloudflare: the site (static assets) plus the device-sync API.
//   GET /v1/s/:id  → { iv, data, updatedAt } | 404
//   PUT /v1/s/:id  ← { iv, data, updatedAt } → { updatedAt } | 409 { updatedAt } when the stored copy is newer
// :id is SHA-256(sync key) in hex; data is encrypted on the device. No listing endpoint exists.

const MAX_BODY = 64 * 1024;
const DAY = 86_400_000;
const EXPIRE_AFTER = 365 * DAY;

function corsHeaders(req, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // www → bare domain
    if (env.CANONICAL_HOST && url.hostname === `www.${env.CANONICAL_HOST}`) {
      url.hostname = env.CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }
    // everything outside the API is the site
    if (!url.pathname.startsWith("/v1/")) {
      return env.ASSETS ? env.ASSETS.fetch(req) : new Response("Not found", { status: 404 });
    }

    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const m = url.pathname.match(/^\/v1\/s\/([0-9a-f]{64})$/);
    if (!m) return json({ error: "not_found" }, 404, cors);
    const id = m[1];

    if (req.method === "GET") {
      const row = await env.DB.prepare("SELECT iv, data, updated_at FROM sync WHERE id = ?").bind(id).first();
      if (!row) return json({ error: "not_found" }, 404, cors);
      return json({ iv: row.iv, data: row.data, updatedAt: row.updated_at }, 200, cors);
    }

    if (req.method === "PUT") {
      const text = await req.text();
      if (text.length > MAX_BODY) return json({ error: "too_large" }, 413, cors);
      let body;
      try { body = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400, cors); }
      const { iv, data, updatedAt } = body || {};
      const now = Date.now();
      if (typeof iv !== "string" || iv.length > 32 || typeof data !== "string" || !data
        || !Number.isSafeInteger(updatedAt) || updatedAt <= 0 || updatedAt > now + DAY) {
        return json({ error: "bad_request" }, 400, cors);
      }
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

    return json({ error: "method_not_allowed" }, 405, cors);
  },

  async scheduled(_event, env) {
    await env.DB.prepare("DELETE FROM sync WHERE written_at < ?").bind(Date.now() - EXPIRE_AFTER).run();
  },
};
