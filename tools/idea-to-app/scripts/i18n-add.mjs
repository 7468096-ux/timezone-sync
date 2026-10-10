#!/usr/bin/env node
// Adds or replaces strings in all 10 languages of an app's src/i18n.js in one go.
// Usage: node scripts/i18n-add.mjs <app>/src/i18n.js strings.json [--remove key1,key2]
//   strings.json: { "key": { "en": "…", "ru": "…", "zh": "…", "hi": "…", "es": "…",
//                            "ar": "…", "fr": "…", "bn": "…", "pt": "…", "id": "…" }, … }
// Fails if any key lacks a language, so nothing ships half-translated.
import { readFileSync, writeFileSync } from "node:fs";

const [file, json, flag, removeList] = process.argv.slice(2);
if (!file || !json) { console.error("usage: i18n-add.mjs src/i18n.js strings.json [--remove a,b]"); process.exit(1); }
const LANGS = ["en", "ru", "zh", "hi", "es", "ar", "fr", "bn", "pt", "id"];
const add = JSON.parse(readFileSync(json, "utf8"));
const remove = flag === "--remove" ? removeList.split(",").map(s => s.trim()).filter(Boolean) : [];
for (const [k, tr] of Object.entries(add)) {
  if (!/^[A-Za-z_]\w*$/.test(k)) { console.error(`bad key ${k}`); process.exit(1); }
  const missing = LANGS.filter(l => typeof tr[l] !== "string" || !tr[l]);
  if (missing.length) { console.error(`${k}: missing ${missing.join(", ")}`); process.exit(1); }
}
let src = readFileSync(file, "utf8");
for (const lang of LANGS) {
  const start = src.indexOf(`\n  ${lang}: {\n`);
  if (start < 0) { console.error(`no block for ${lang}`); process.exit(1); }
  const end = src.indexOf("\n  },", start);
  let block = src.slice(start, end);
  for (const k of [...remove, ...Object.keys(add)]) {
    block = block.replace(new RegExp(`\\n {4}${k}: (?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'),`, "g"), "");
  }
  for (const [k, tr] of Object.entries(add)) block += `\n    ${k}: ${JSON.stringify(tr[lang])},`;
  src = src.slice(0, start) + block + src.slice(end);
}
writeFileSync(file, src);
console.log(`i18n: ${Object.keys(add).length} key(s) set in ${LANGS.length} languages${remove.length ? `, ${remove.length} removed` : ""}`);
