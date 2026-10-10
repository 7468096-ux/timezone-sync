import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeState, addItem, toggleItem, removeItem, restoreItem } from "../src/core/model.js";
import { encodeShare, decodeShare } from "../src/lib/share.js";

test("sanitize drops junk instead of crashing", () => {
  assert.equal(sanitizeState(null), null);
  assert.equal(sanitizeState({ items: "x" }), null);
  const s = sanitizeState({ items: [null, { text: "  ok " }, { text: "" }, { text: 5, done: "yes" }] });
  assert.deepEqual(s.items, [{ id: 1, text: "ok", done: false }, { id: 2, text: "5", done: false }]);
});

test("add, toggle, remove with undo", () => {
  let s = { items: [] };
  s = addItem(s, " milk ");
  s = addItem(s, "   ");
  assert.equal(s.items.length, 1);
  s = toggleItem(s, 1);
  assert.equal(s.items[0].done, true);
  const r = removeItem(s, 1);
  assert.equal(r.state.items.length, 0);
  assert.equal(restoreItem(r.state, r.removed).items[0].text, "milk");
});

test("share codes roundtrip (unicode, separators) and damaged ones are reported", () => {
  const s = sanitizeState({ items: [{ text: "Привет, мир ~ 你好 #1" }] });
  assert.deepEqual(decodeShare(encodeShare(s), sanitizeState), s);
  assert.deepEqual(decodeShare("https://x.app/#" + encodeShare(s), sanitizeState), s);
  assert.equal(decodeShare("s.@@@", sanitizeState), "invalid");
  assert.equal(decodeShare(encodeShare(s).slice(0, -6), sanitizeState), "invalid"); // cut off in a messenger
  assert.equal(decodeShare("hello", sanitizeState), null);
});
