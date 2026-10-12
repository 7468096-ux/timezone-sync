import { test } from "node:test";
import assert from "node:assert/strict";
import { LANGS, STRINGS, makeT } from "../src/v2/i18n.js";

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

test("every key the interface uses is defined", async () => {
  const { readFileSync } = await import("node:fs");
  const src = ["src/v2/App.jsx", "src/v2/Corp.jsx", "src/v2/common.jsx", "src/v2/i18n.js"].map(f => readFileSync(f, "utf8")).join("\n");
  const used = new Set([...src.matchAll(/\bt\("([A-Za-z]+)"/g)].map(m => m[1]));
  for (const m of src.matchAll(/t\(EMBED \? "(\w+)" : "(\w+)"\)/g)) { used.add(m[1]); used.add(m[2]); }
  const missing = [...used].filter(k => !(k in STRINGS.en));
  assert.deepEqual(missing, []);
});

test("the example company is valid in every language", async () => {
  const { makeCorpExample } = await import("../src/v2/i18n.js");
  const { sanitizeCorp, findCall } = await import("../src/lib/corp.js");
  for (const { code } of LANGS) {
    for (const today of ["2026-10-13", "2026-10-17"]) { // a Tuesday and a Saturday
      const corp = sanitizeCorp(makeCorpExample(code, "Europe/Belgrade", today));
      assert.equal(corp.colleagues.length, 4, code);
      assert.ok(findCall(corp, { from: today, today, nowMin: 0, len: 30 }).slot, `${code}: the example opens on an answer`);
    }
  }
});
