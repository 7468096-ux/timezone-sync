import { test } from "node:test";
import assert from "node:assert/strict";
import { newKey, parseKey, encryptPayload, decryptPayload } from "../src/lib/sync.js";

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
