import { test } from "node:test";
import assert from "node:assert/strict";
import { newKey, parseKey, encryptPayload, decryptPayload, push, pull, revoke } from "../src/lib/sync.js";
import worker from "../worker/src/index.js";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

test("sync key parsing and end-to-end encryption", async () => {
  const k = newKey();
  assert.match(k, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(parseKey(`https://example.com/#sync.${k}`), k);
  assert.equal(parseKey(`  ${k} `), k);
  assert.equal(parseKey("not a key"), null);
  const payload = { items: [{ id: 1, text: "Секрет", done: false }] };
  const box = await encryptPayload(k, payload);
  assert.ok(!atob(box.data).includes("Секрет"));
  assert.deepEqual(await decryptPayload(k, box), payload);
  await assert.rejects(() => decryptPayload(newKey(), box));
});

test("client against the worker: round trip, then change code revokes the old key", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../worker/schema.sql", import.meta.url), "utf8"));
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }) });
  const env = { DB: { prepare: (sql) => stmt(sql) } };
  globalThis.fetch = (url, init) => worker.fetch(new Request(url, init), env);
  const base = "https://example.app", k = newKey();
  assert.deepEqual(await push(k, { items: [] }, 1000, base), { ok: true });
  assert.deepEqual((await pull(k, base)).payload, { items: [] });
  await revoke(k, base);
  assert.deepEqual(await pull(k, base), { found: false, revoked: true });
  assert.deepEqual(await push(k, { items: [] }, 2000, base), { ok: false, revoked: true });
});
