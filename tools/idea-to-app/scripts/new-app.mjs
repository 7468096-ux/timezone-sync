#!/usr/bin/env node
// Creates a new project from ../template with every placeholder filled in.
// Usage:
//   node scripts/new-app.mjs --out ../my-app --name "Split Bill" --slug split-bill \
//        [--tagline "Split a bill fairly in seconds"] [--domain split-bill.app] \
//        [--donate https://ko-fi.com/you] [--accent f0c050]
// Then: cd ../my-app && npm install && npm test && npm run build
import { cpSync, readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const need = (k) => { if (!args[k]) { console.error(`missing --${k}`); process.exit(1); } return args[k]; };

const out = need("out");
const name = need("name");
const slug = (args.slug || name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const domain = args.domain || `${slug}.example.com`;
const accent = (args.accent || "f0c050").replace(/^#/, "");
if (!/^[0-9a-fA-F]{6}$/.test(accent)) { console.error("--accent must be 6 hex digits"); process.exit(1); }
if (existsSync(out) && readdirSync(out).length) { console.error(`${out} is not empty`); process.exit(1); }

const values = {
  __APP_NAME__: name,
  __APP_SLUG__: slug,
  __APP_TAGLINE__: args.tagline || name,
  __DOMAIN__: domain,
  __SITE_URL__: `https://${domain}`,
  __DONATE_URL__: args.donate || "",
  __ACCENT_HEX__: accent.toLowerCase(),
};

const template = join(dirname(fileURLToPath(import.meta.url)), "..", "template");
cpSync(template, out, { recursive: true, filter: (p) => !/(^|[\\/])(node_modules|dist[\w-]*)([\\/]|$)/.test(relative(template, p)) });

const walk = (dir) => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
for (const file of walk(out)) {
  let s = readFileSync(file, "utf8");
  const before = s;
  for (const [k, v] of Object.entries(values)) s = s.split(k).join(v);
  if (s !== before) writeFileSync(file, s);
}
const left = walk(out).filter(f => /__(APP_[A-Z]+|DOMAIN|SITE_URL|DONATE_URL|ACCENT_HEX)__/.test(readFileSync(f, "utf8")));
if (left.length) { console.error("unfilled placeholders in:", left.join(", ")); process.exit(1); }
console.log(`Created ${out} (${slug}). Next: cd ${out} && npm install && npm test && npm run build`);
