// Device sync security: the Worker against an in-memory SQLite that mimics the D1 calls it uses,
// the real client (src/lib/sync.js) talking to it, and the old-address migration link.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import worker from "../worker/src/index.js";
import { newKey, push, pull, revoke, encryptPayload } from "../src/lib/sync.js";

function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../worker/schema.sql", import.meta.url), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
  });
  return { prepare: (sql) => stmt(sql) };
}

const makeEnv = (extra = {}) => ({
  DB: fakeD1(), CANONICAL_HOST: "timezone-sync.com.co", ALLOWED_ORIGINS: "https://timezone-sync.com.co", ...extra,
});
const BASE = "https://timezone-sync.com.co";

// route the client's fetch() to the Worker
function useWorker(env) {
  globalThis.fetch = (url, init) => worker.fetch(new Request(url, init), env);
}

test("client ↔ worker: round trip, the server never sees the key or the names", async () => {
  const env = makeEnv();
  useWorker(env);
  const key = newKey();
  const payload = { people: [{ name: "Секретный клиент", tz: "Europe/Belgrade" }] };
  assert.deepEqual(await push(key, payload, 1000, BASE), { ok: true });
  const r = await pull(key, BASE);
  assert.deepEqual(r.payload, payload);
  const dump = JSON.stringify(await env.DB.prepare("SELECT * FROM sync").first())
    + JSON.stringify(await env.DB.prepare("SELECT * FROM sync_auth").first());
  assert.ok(!dump.includes(key) && !dump.includes("Секрет"));
});

test("knowing only the id (e.g. from logs) is not enough to overwrite", async () => {
  const env = makeEnv();
  useWorker(env);
  const key = newKey();
  await push(key, { people: [] }, 1000, BASE);
  const id = createHash("sha256").update(`tz-sync:id:${key}`).digest("hex");
  const evil = { ...(await encryptPayload(newKey(), { people: [] })), updatedAt: Date.now() + 3600_000 };
  const put = (body) => worker.fetch(new Request(`${BASE}/v1/s/${id}`, { method: "PUT", body: JSON.stringify(body) }), env);
  assert.equal((await put(evil)).status, 400, "no auth");
  assert.equal((await put({ ...evil, auth: "f".repeat(64) })).status, 403, "wrong auth");
  assert.equal((await pull(key, BASE)).updatedAt, 1000, "data untouched");
  assert.deepEqual(await push(key, { people: [] }, 2000, BASE), { ok: true }, "the owner still writes");
});

test("rate limit: writes and the counter answer 429 once the binding says no", async () => {
  const env = makeEnv({ RATE_LIMIT: { limit: async () => ({ success: false }) } });
  useWorker(env);
  await assert.rejects(() => push(newKey(), { people: [] }, 1000, BASE), /sync 429/);
  const r = await worker.fetch(new Request(`${BASE}/v1/hello`, { method: "POST", body: JSON.stringify({ id: "1".repeat(32) }) }), env);
  assert.equal(r.status, 429);
  const big = await worker.fetch(new Request(`${BASE}/v1/s/${"a".repeat(64)}`, {
    method: "PUT", headers: { "Content-Length": String(1 << 20) }, body: "x",
  }), makeEnv());
  assert.equal(big.status, 413);
});

test("migration link never adopts a sync key silently", async () => {
  const store = new Map();
  let hash = "";
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k),
  };
  globalThis.window = { location: { pathname: "/", search: "", get hash() { return hash; } } };
  globalThis.history = { replaceState: (_s, _t, url) => { hash = url.includes("#") ? url.slice(url.indexOf("#")) : ""; } };
  const planted = "A".repeat(22);
  const d = { p: [{ name: "X", city: "Y", tz: "Europe/Berlin", workHours: [9, 10] }], k: planted, m: { localAt: 1 } };
  hash = "#migrate." + Buffer.from(JSON.stringify(d)).toString("base64url");
  const { consumeMigration, takeHash } = await import("../src/lib/storage.js");
  assert.equal(consumeMigration(), true);
  assert.equal(store.get("tz-sync-device-key"), undefined, "key not stored");
  assert.ok(store.get("tz-sync-people"), "people still migrated");
  assert.deepEqual(takeHash(), { sync: planted }, "the key becomes an ask-first sync link");
});

test("changing the code: the old key is erased and stays dead on every device", async () => {
  const env = makeEnv();
  useWorker(env);
  const key = newKey();
  await push(key, { people: [{ name: "A" }] }, 1000, BASE);
  const id = createHash("sha256").update(`tz-sync:id:${key}`).digest("hex");
  const del = (auth) => worker.fetch(new Request(`${BASE}/v1/s/${id}`, { method: "DELETE", body: JSON.stringify({ auth }) }), env);
  assert.equal((await del("f".repeat(64))).status, 403, "only the key's owner can revoke");
  await revoke(key, BASE);
  assert.deepEqual(await pull(key, BASE), { found: false, revoked: true });
  assert.deepEqual(await push(key, { people: [] }, 5000, BASE), { ok: false, revoked: true }, "an old device can't bring it back");
  assert.equal(await env.DB.prepare("SELECT 1 FROM sync WHERE id = ?").bind(id).first(), null, "ciphertext erased");
  await worker.scheduled({}, env);
  assert.deepEqual(await pull(key, BASE), { found: false, revoked: true }, "the tombstone survives the daily cleanup");
});

test("pages allow scripts from the site itself only", async () => {
  const env = makeEnv({ ASSETS: { fetch: async () => new Response("<div id=\"root\"></div>") } });
  const page = await worker.fetch(new Request(`${BASE}/`), env);
  const csp = page.headers.get("Content-Security-Policy");
  assert.match(csp, /script-src 'self';/);
  assert.ok(!csp.includes("gc.zgo.at"));
});
