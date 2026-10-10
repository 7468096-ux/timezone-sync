// The Worker's API against an in-memory SQLite that mimics the D1 calls it uses
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/src/index.js";

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

const env = {
  DB: fakeD1(), CANONICAL_HOST: "example.app", ALLOWED_ORIGINS: "https://example.app", APP_VERSION: "abc1234",
  ASSETS: { fetch: async () => new Response('<div id="root"></div>', { headers: { "Content-Type": "text/html" } }) },
};
const call = (path, init) => worker.fetch(new Request(`https://example.app${path}`, init), env);
const id = "a".repeat(64);

test("site: https redirect, security headers, version", async () => {
  const r = await worker.fetch(new Request("http://www.example.app/x?y=1"), env);
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("Location"), "https://example.app/x?y=1");
  const page = await call("/");
  assert.match(page.headers.get("Content-Security-Policy"), /default-src 'self'/);
  assert.ok(page.headers.get("Strict-Transport-Security"));
  assert.equal(page.headers.get("X-App-Version"), "abc1234");
});

test("sync: write, read, reject an older write", async () => {
  assert.equal((await call(`/v1/s/${id}`)).status, 404);
  const put = (updatedAt, data) => call(`/v1/s/${id}`, { method: "PUT", body: JSON.stringify({ iv: "AAAA", data, updatedAt }) });
  assert.equal((await put(2000, "bmV3")).status, 200);
  assert.equal((await call(`/v1/s/${id}`).then(r => r.json())).data, "bmV3");
  assert.equal((await put(1000, "b2xk")).status, 409);
  assert.equal((await put(1000, "")).status, 400);
});

test("counter: each browser once", async () => {
  const hello = (vid) => call("/v1/hello", { method: "POST", body: JSON.stringify({ id: vid }) }).then(r => r.json());
  assert.equal((await hello("1".repeat(32))).users, 1);
  assert.equal((await hello("1".repeat(32))).users, 1);
  assert.equal((await hello("2".repeat(32))).users, 2);
  assert.equal((await call("/v1/stats").then(r => r.json())).users, 2);
});
