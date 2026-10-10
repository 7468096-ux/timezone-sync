import { test } from "node:test";
import assert from "node:assert/strict";
import { LANGS, STRINGS, makeT } from "../src/i18n.js";

test("every string exists in all 10 languages", () => {
  assert.equal(LANGS.length, 10);
  const keys = Object.keys(STRINGS.en);
  for (const { code } of LANGS) {
    const missing = keys.filter(k => typeof STRINGS[code]?.[k] !== "string" || !STRINGS[code][k]);
    assert.deepEqual(missing, [], `${code} is missing: ${missing.join(", ")}`);
  }
});

test("placeholders survive translation", () => {
  for (const { code } of LANGS) {
    for (const [k, en] of Object.entries(STRINGS.en)) {
      const vars = (en.match(/\{\w+\}/g) || []).sort().join();
      assert.equal((STRINGS[code][k].match(/\{\w+\}/g) || []).sort().join(), vars, `${code}.${k}`);
    }
  }
  assert.equal(makeT("ru")("usersCount", { n: 5 }), "Пользователей: 5");
});
