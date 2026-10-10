// Checks the built page in a real (headless) browser the way a user would, and saves screenshots.
// Usage: npm run build:artifact && npm run verify [-- <page.html or URL> <out dir>]
//   default page: dist-artifact/<name>.html (works from file://, no server needed); out: verify-out/
// Generic checks: loads without console errors · desktop dark + phone light screenshots · Arabic is RTL ·
// no sideways page scroll at 390 px in any of the 10 languages · a damaged link shows a notice and keeps data.
// App-specific flows: put them in tests/flows.mjs →  export default async ({ page, check, url, shot }) => {…}
// Playwright: uses the "playwright" package if installed, else PLAYWRIGHT_MODULE (path to its index.mjs),
// else the preinstalled /opt/node-tools copy found in Claude's sandboxes.
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const target = process.argv[2] || `dist-artifact/${pkg.name}.html`;
const outDir = resolve(process.argv[3] || "verify-out");
const url = /^https?:/.test(target) ? target : pathToFileURL(resolve(target)).href;
if (!/^https?:/.test(target) && !existsSync(target)) { console.error(`${target} not found — run npm run build:artifact first`); process.exit(1); }
mkdirSync(outDir, { recursive: true });

async function loadPlaywright() {
  for (const spec of ["playwright", process.env.PLAYWRIGHT_MODULE, "/opt/node-tools/node_modules/playwright/index.mjs"]) {
    if (!spec) continue;
    try { return await import(spec.startsWith("/") ? pathToFileURL(spec).href : spec); } catch {}
  }
  console.error("Playwright not found: npm i -D playwright (and npx playwright install chromium), or set PLAYWRIGHT_MODULE");
  process.exit(1);
}
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok: !!ok, extra }); };
const shot = (page, name) => page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
const LS_LANG = `${pkg.name}-lang`;

async function open({ lang, mobile, scheme = "dark", hash = "" } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme }
    : { viewport: { width: 1100, height: 900 }, colorScheme: scheme });
  if (lang) await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, [LS_LANG, lang]);
  const page = await ctx.newPage();
  const tag = `${lang || "en"}${mobile ? "/390" : ""}`;
  page.on("console", m => { if (m.type() === "error") errors.push(`[${tag}] ${m.text()}`); });
  page.on("pageerror", e => errors.push(`[${tag}] ${e.message}`));
  await page.goto(url + hash);
  await page.waitForSelector("#root > *");
  return { ctx, page };
}
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// desktop, dark
{
  const { ctx, page } = await open();
  check("desktop renders a headline", await page.locator("h1").count());
  await shot(page, "desktop-dark");
  await ctx.close();
}
// phone, light
{
  const { ctx, page } = await open({ mobile: true, scheme: "light" });
  check("phone: no sideways scroll (en)", await noSideScroll(page));
  await shot(page, "phone-light");
  await ctx.close();
}
// Arabic: RTL
{
  const { ctx, page } = await open({ lang: "ar", mobile: true });
  check("Arabic sets dir=rtl", (await page.evaluate(() => document.documentElement.dir)) === "rtl");
  await shot(page, "phone-arabic");
  await ctx.close();
}
// every language at 390 px
for (const lang of ["ru", "zh", "hi", "es", "fr", "bn", "pt", "id"]) {
  const { ctx, page } = await open({ lang, mobile: true });
  check(`phone: no sideways scroll (${lang})`, await noSideScroll(page));
  await ctx.close();
}
// damaged link: notice, data kept, hash cleared
{
  const { ctx, page } = await open({ hash: "#s.eyJpdGVtcyI6W" });
  check("damaged link shows a notice", await page.locator(".notice.bad").count());
  check("hash is cleared after reading", !(await page.evaluate(() => location.hash)));
  await ctx.close();
}
// app-specific flows
if (existsSync("tests/flows.mjs")) {
  const flows = (await import(pathToFileURL(resolve("tests/flows.mjs")).href)).default;
  const { ctx, page } = await open();
  try { await flows({ page, check, url, shot: (name) => shot(page, name), open }); }
  catch (e) { check("flows.mjs ran", false, e.message); }
  await ctx.close();
}

await browser.close();
check("no console errors", errors.length === 0, errors.slice(0, 5).join(" | "));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.extra ? `  — ${r.extra}` : ""}`);
console.log(`\nScreenshots: ${outDir}  — look at them before reporting.`);
process.exit(results.every(r => r.ok) ? 0 : 1);
