// Checks the built single-file page in a real (headless) browser the way a user would, and saves screenshots.
// Usage: npm run build:artifact -- v2 && npm run verify [-- <page.html> <out dir>]
// The clock is pinned to Tuesday 13 Oct 2026, 09:30 in Belgrade, so the answers below are exact.
// Playwright: the "playwright" package if installed, else PLAYWRIGHT_MODULE, else the copy in Claude's sandboxes.
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2] || "dist-artifact/timezone-sync-v2.html";
const outDir = resolve(process.argv[3] || "verify-out");
if (!existsSync(target)) { console.error(`${target} not found — run npm run build:artifact -- v2 first`); process.exit(1); }
const url = pathToFileURL(resolve(target)).href;
mkdirSync(outDir, { recursive: true });

async function loadPlaywright() {
  for (const spec of ["playwright", process.env.PLAYWRIGHT_MODULE, "/opt/npm-tools/node_modules/playwright/index.mjs", "/opt/node-tools/node_modules/playwright/index.mjs"]) {
    if (!spec) continue;
    try { return await import(spec.startsWith("/") ? pathToFileURL(spec).href : spec); } catch {}
  }
  console.error("Playwright not found: npm i -D playwright, or set PLAYWRIGHT_MODULE");
  process.exit(1);
}
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];
const results = [];
const check = (name, ok, extra = "") => results.push({ name, ok: !!ok, extra });
const shot = (page, name) => page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
const NOW = new Date("2026-10-13T07:30:00Z"); // 09:30 in Belgrade

async function open({ lang = "en", mobile = false, scheme = "dark", hash = "", planner = "corp", storage = {} } = {}) {
  const ctx = await browser.newContext({
    ...(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1180, height: 900 } }),
    colorScheme: scheme, timezoneId: "Europe/Belgrade", locale: "en-US",
  });
  await ctx.addInitScript((items) => {
    if (sessionStorage.getItem("seeded")) return; // seed once: reloads must see what the app saved
    sessionStorage.setItem("seeded", "1");
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
  }, { "tz-sync-lang": lang, "tz-sync-mode": planner, ...storage });
  const page = await ctx.newPage();
  await page.clock.install({ time: NOW });
  const tag = `${lang}${mobile ? "/390" : ""}`;
  page.on("console", m => { if (m.type() === "error") errors.push(`[${tag}] ${m.text()}`); });
  page.on("pageerror", e => errors.push(`[${tag}] ${e.message}`));
  await page.goto(url + hash);
  await page.waitForSelector("#root h1");
  return { ctx, page };
}
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const answer = (page) => page.locator(".slot-time").first().innerText();
// drag across a colleague's row: from quarter a to quarter b (0 = 09:00)
async function dragRow(page, row, a, b) {
  const cells = page.locator(".cgrid > .q");
  const perRow = await page.evaluate(() => document.querySelectorAll(".cgrid > .q").length / document.querySelectorAll(".cgrid > .name").length);
  const box = async (q) => (await cells.nth(row * perRow + q).boundingBox());
  const s = await box(a), e = await box(b);
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move((s.x + e.x) / 2 + e.width / 2, e.y + e.height / 2, { steps: 4 });
  await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2, { steps: 4 });
  await page.mouse.up();
}

/* ── Company planner: the main flows ── */
{
  const { ctx, page } = await open();
  check("company tab is selected", (await page.locator('.modes [aria-selected="true"]').innerText()).includes("Company"));
  check("headline", (await page.locator("h1").innerText()) === "Plan a call at work");
  check("example team opens on an answer: 09:30–10:00 today", (await answer(page)) === "09:30–10:00", await answer(page));
  check("who list: 4 colleagues, all ticked", (await page.locator(".who-row.corp .check.on").count()) === 4);
  check("strip shows 10 workdays", (await page.locator(".strip .sday").count()) === 10);
  await shot(page, "corp-desktop-dark");

  // a one-hour call: stand-up at 10, client calls 11–13, lunch, review 14–15:30, focus 15–17 → 17:00
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Longer" }).click();
  check("1 h call → 17:00–18:00", (await answer(page)) === "17:00–18:00", await answer(page));
  // the windows list offers the next ones
  check("next windows listed", (await page.locator(".chips .chip").count()) >= 3);

  // not inviting Mark frees 11:00
  await page.getByRole("checkbox", { name: /Mark/ }).click();
  check("without Mark → 10:15–11:15", (await answer(page)) === "10:15–11:15", await answer(page));
  await page.getByRole("checkbox", { name: /Mark/ }).click();

  // edit mode: draw a meeting for "You" 17:00–17:45 (quarters 32..34) → no 1 h slot today → tomorrow 09:00
  await page.getByRole("button", { name: "Edit meetings" }).click();
  await dragRow(page, 0, 32, 34);
  const sheet = page.locator(".sheet");
  check("drawing opens a new meeting", (await sheet.locator("h2").innerText()) === "New meeting");
  check("drawn time is 17:00–17:45", (await sheet.locator("#blk-from").inputValue()) === "1020" && (await sheet.locator("#blk-to").inputValue()) === "1065");
  await sheet.locator("#blk-name").fill("Sync, Q4 #1");
  await shot(page, "corp-new-meeting");
  await sheet.getByRole("button", { name: "Add" }).click();
  check("meeting bar drawn", (await page.locator(".cblock", { hasText: "Sync, Q4 #1" }).count()) === 1);
  check("answer moves to tomorrow 09:00–10:00", (await answer(page)) === "09:00–10:00" && (await page.locator(".slot-sub b").innerText()).includes("Wednesday"),
    `${await answer(page)} ${await page.locator(".slot-sub b").innerText()}`);

  // delete it, then undo
  await page.locator(".cblock", { hasText: "Sync, Q4 #1" }).click();
  await page.locator(".sheet").getByRole("button", { name: "Delete" }).click();
  check("deleted → today 17:00 again", (await answer(page)) === "17:00–18:00");
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  check("undo brings it back", (await page.locator(".cblock", { hasText: "Sync, Q4 #1" }).count()) === 1 && (await answer(page)) === "09:00–10:00");

  // picking a busy time explains who is busy and why
  await page.getByRole("button", { name: "Pick a time" }).click();
  await page.locator(".strip .sday").first().click();
  await page.locator(".cgrid .chh").nth(2).click(); // 11:00
  check("picked 11:00: Mark is busy with client calls",
    (await page.locator(".who-row.corp", { hasText: "Mark" }).locator(".who-why").innerText()).includes("Client calls"));
  check("clash is highlighted on the grid", (await page.locator(".cblock.clash").count()) >= 1);
  await shot(page, "corp-picked-busy");

  // copy for chat (clipboard may be blocked in headless → manual-copy box)
  await page.getByRole("button", { name: "Back to nearest" }).click().catch(() => {});
  await page.getByRole("button", { name: "Copy for chat" }).click();
  const invite = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null)
    ?? await page.locator("#copy-text").inputValue().catch(() => "");
  check("invite text has the day and people", /Call: .*09:00–10:00/.test(invite) && invite.includes("• Anna (Design)"), invite.split("\n")[0]);
  await page.getByRole("button", { name: "Done" }).click().catch(() => {});

  // company settings: lunch off, Saturday on
  await page.locator(".toolbar").getByRole("button", { name: "Company" }).click();
  await shot(page, "corp-settings");
  await page.locator(".sheet .switch").click();
  await page.locator(".sheet").getByRole("button", { name: "Save" }).click();
  check("settings saved, sheet closed", (await page.locator(".sheet").count()) === 0);

  // share code → open it in a fresh browser
  await page.getByRole("button", { name: "Copy code" }).click();
  const code = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null)
    ?? await page.locator("#copy-text").inputValue().catch(() => "");
  check("share code is a company code", /^c1\.[A-Za-z0-9_-]+$/.test(code), code.slice(0, 20));
  // reload keeps everything
  await page.reload();
  await page.waitForSelector("#root h1");
  check("reload keeps the meeting", (await page.locator(".cblock", { hasText: "Sync, Q4 #1" }).count()) === 1);
  check("reload keeps the company tab", (await page.locator("h1").innerText()) === "Plan a call at work");
  await ctx.close();

  const fresh = await open({ planner: "world", hash: `#${code}` });
  check("company link opens the Company tab", (await fresh.page.locator("h1").innerText()) === "Plan a call at work");
  check("company link: notice shown", (await fresh.page.locator(".notice").innerText()).includes("company setup"));
  check("company link: same meetings", (await fresh.page.locator(".cblock", { hasText: "Sync, Q4 #1" }).count()) === 1);
  check("company link: hash cleared", !(await fresh.page.evaluate(() => location.hash)));
  await fresh.ctx.close();
}

/* ── coffee button: only the cup, the phrase as its name ── */
{
  const { ctx, page } = await open({ lang: "ru" });
  const d = page.locator("a.donate");
  check("coffee button shows only ☕", (await d.innerText()).trim() === "☕", await d.innerText());
  check("coffee button keeps its name", (await d.getAttribute("aria-label")) === "На кофеёк" && (await d.getAttribute("title")) === "На кофеёк");
  await ctx.close();
}

/* ── World planner still works, and the tabs switch ── */
{
  const { ctx, page } = await open({ planner: "world" });
  check("world headline", (await page.locator("h1").innerText()) === "Find a time to meet");
  check("world grid present", (await page.locator(".grid .cell").count()) > 24);
  await page.getByRole("tab", { name: "Company" }).click();
  check("tab switches to Company", (await page.locator(".cgrid").count()) === 1);
  await page.getByRole("tab", { name: "World" }).click();
  check("tab switches back to World", (await page.locator(".grid").count()) === 1);
  await shot(page, "world-desktop-dark");
  await ctx.close();
}

/* ── phone, light; Arabic RTL; every language at 390 px ── */
{
  const { ctx, page } = await open({ mobile: true, scheme: "light" });
  check("phone: no sideways scroll (en)", await noSideScroll(page));
  await shot(page, "corp-phone-light");
  // touch: tap in edit mode proposes a meeting as long as the call
  await page.getByRole("button", { name: "Edit meetings" }).tap();
  const q = page.locator(".cgrid > .q").nth(8); // You, 11:00
  await q.evaluate(el => el.scrollIntoView({ inline: "center", block: "center" }));
  await q.tap();
  check("phone: tap opens a new meeting", (await page.locator(".sheet h2").innerText()) === "New meeting");
  await shot(page, "corp-phone-sheet");
  await ctx.close();
}
{
  const { ctx, page } = await open({ lang: "ar", mobile: true });
  check("Arabic sets dir=rtl", (await page.evaluate(() => document.documentElement.dir)) === "rtl");
  check("Arabic: no sideways scroll", await noSideScroll(page));
  await shot(page, "corp-phone-arabic");
  await ctx.close();
}
for (const lang of ["ru", "zh", "hi", "es", "fr", "bn", "pt", "id"]) {
  for (const planner of ["corp", "world"]) {
    const { ctx, page } = await open({ lang, mobile: true, planner });
    check(`phone: no sideways scroll (${lang}, ${planner})`, await noSideScroll(page));
    if (lang === "ru" && planner === "corp") await shot(page, "corp-phone-ru");
    await ctx.close();
  }
}
{
  const { ctx, page } = await open({ lang: "ru" });
  await shot(page, "corp-desktop-ru");
  await ctx.close();
}
// damaged company link: notice, data kept
{
  const { ctx, page } = await open({ hash: "#c1.eyJ6IjoiRXVyb3BlL0Jl" });
  check("damaged company link shows a notice", await page.locator(".notice.bad").count());
  check("damaged link keeps the example team", (await page.locator(".who-row.corp").count()) === 4);
  await ctx.close();
}

await browser.close();
// fonts and the user counter come from the network; a sandbox without it isn't an app error
const appErrors = errors.filter(e => !/Failed to load resource: net::/.test(e));
check("no console errors", appErrors.length === 0, appErrors.slice(0, 5).join(" | "));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.extra ? `  — ${r.extra}` : ""}`);
console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed. Screenshots: ${outDir}`);
process.exit(results.every(r => r.ok) ? 0 : 1);
