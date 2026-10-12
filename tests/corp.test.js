import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isDate, addDays, weekday, nowIn, toInstant, fmtMin, occursOn, commonFree, findCall, daySummary,
  sanitizeCorp, encodeCorp, decodeCorp, sameCorp, pruneOld, buildIcs, conflictsAt, workdaysAhead,
} from "../src/lib/corp.js";

// 2026-10-13 is a Tuesday
const TUE = "2026-10-13";
const base = (colleagues, extra = {}) => sanitizeCorp({
  tz: "Europe/Belgrade", day: { start: 540, end: 1080 }, workdays: [1, 2, 3, 4, 5], lunch: null,
  colleagues, ...extra,
});
const block = (title, date, s, e, repeat = "once") => ({ title, date, start: s * 60, end: e * 60, repeat });

test("calendar dates", () => {
  assert.equal(weekday(TUE), 2);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.ok(isDate("2028-02-29"));
  assert.ok(!isDate("2026-02-30"));
  assert.ok(!isDate("13.10.2026"));
  assert.deepEqual(workdaysAhead(base([{ name: "A" }]), "2026-10-16", 4), ["2026-10-16", "2026-10-19"]);
});

test("now and instants in the company zone, across DST", () => {
  assert.deepEqual(nowIn("Europe/Belgrade", new Date("2026-10-12T22:30:00Z")), { date: "2026-10-13", min: 30 });
  // summer (UTC+2) and winter (UTC+1)
  assert.equal(new Date(toInstant("2026-07-01", 600, "Europe/Belgrade")).toISOString(), "2026-07-01T08:00:00.000Z");
  assert.equal(new Date(toInstant("2026-11-02", 600, "Europe/Belgrade")).toISOString(), "2026-11-02T09:00:00.000Z");
  // the day the clocks go back
  assert.equal(new Date(toInstant("2026-10-25", 600, "Europe/Belgrade")).toISOString(), "2026-10-25T09:00:00.000Z");
  assert.equal(new Date(toInstant("2026-01-15", 570, "Asia/Kolkata")).toISOString(), "2026-01-15T04:00:00.000Z");
  assert.equal(fmtMin(570), "09:30");
  assert.equal(fmtMin(1440), "24:00");
});

test("repeats: once, every workday, weekly", () => {
  const wd = [1, 2, 3, 4, 5];
  const once = block("x", TUE, 10, 11);
  assert.ok(occursOn(once, TUE, wd));
  assert.ok(!occursOn(once, addDays(TUE, 7), wd));
  const daily = block("standup", TUE, 10, 10.25, "daily");
  assert.ok(!occursOn(daily, addDays(TUE, -1), wd), "not before it starts");
  assert.ok(occursOn(daily, addDays(TUE, 3), wd), "Friday");
  assert.ok(!occursOn(daily, addDays(TUE, 4), wd), "not on Saturday");
  const weekly = block("review", TUE, 14, 15, "weekly");
  assert.ok(occursOn(weekly, addDays(TUE, 14), wd));
  assert.ok(!occursOn(weekly, addDays(TUE, 1), wd));
});

test("common free time: work day minus lunch, meetings and the past", () => {
  const corp = base([
    { name: "A", blocks: [block("standup", TUE, 10, 10.25, "daily")] },
    { name: "B", blocks: [block("calls", TUE, 11, 13)] },
  ], { lunch: { start: 780, end: 840 } });
  assert.deepEqual(commonFree(corp, TUE, corp.colleagues, "2026-10-01", 0), [
    { start: 540, end: 600 }, { start: 615, end: 660 }, { start: 840, end: 1080 },
  ]);
  // at 10:07 the morning is gone
  assert.deepEqual(commonFree(corp, TUE, corp.colleagues, TUE, 607)[0], { start: 615, end: 660 });
  // weekend and past days have nothing
  assert.deepEqual(commonFree(corp, "2026-10-17", corp.colleagues, TUE, 0), []);
  assert.deepEqual(commonFree(corp, "2026-10-12", corp.colleagues, TUE, 0), []);
});

test("findCall: earliest start on the 15-minute grid that fits everyone invited", () => {
  const corp = base([
    { name: "A", blocks: [block("a", TUE, 9, 10.1)] },        // until 10:06 → 10:15
    { name: "B", blocks: [block("b", TUE, 10.75, 12)] },      // from 10:45
  ]);
  const r = findCall(corp, { from: TUE, today: TUE, nowMin: 0, len: 30 });
  assert.deepEqual(r.slot, { date: TUE, start: 615, len: 30 });
  assert.deepEqual(r.windows[0], { date: TUE, start: 615, end: 645 });
  // a 45-minute call doesn't fit 10:15–10:45 and moves to noon
  assert.deepEqual(findCall(corp, { from: TUE, today: TUE, nowMin: 0, len: 45 }).slot, { date: TUE, start: 720, len: 45 });
  // "now" rounds up to the grid
  assert.equal(findCall(corp, { from: TUE, today: TUE, nowMin: 731, len: 30 }).slot.start, 735);
  // after hours today → next workday
  assert.deepEqual(findCall(corp, { from: TUE, today: TUE, nowMin: 1075, len: 30 }).slot, { date: "2026-10-14", start: 540, len: 30 });
  // a past "from" day searches from today
  assert.equal(findCall(corp, { from: "2026-10-01", today: TUE, nowMin: 0, len: 30 }).slot.date, TUE);
});

test("findCall: only invited people count; nobody invited → no answer", () => {
  const corp = base([
    { name: "A" },
    { name: "Busy", on: false, blocks: [block("all", TUE, 0, 24, "daily")] },
  ]);
  const r = findCall(corp, { from: TUE, today: TUE, nowMin: 0, len: 60 });
  assert.equal(r.invited.length, 1);
  assert.deepEqual(r.slot, { date: TUE, start: 540, len: 60 });
  const none = base([{ name: "A", on: false }]);
  const n = findCall(none, { from: TUE, today: TUE, nowMin: 0, len: 60 });
  assert.equal(n.slot, null);
  assert.equal(n.partial, null);
});

test("findCall: best partial names who blocks it", () => {
  const corp = base([
    { name: "A" },
    { name: "B" },
    { name: "Away", blocks: [block("vacation", TUE, 0, 24, "daily")] },
  ]);
  const r = findCall(corp, { from: TUE, today: TUE, nowMin: 600, len: 30 });
  assert.equal(r.slot, null);
  assert.deepEqual(r.partial.slot, { date: TUE, start: 600, len: 30 });
  assert.equal(r.partial.count, 2);
  assert.equal(r.partial.total, 3);
  assert.deepEqual(r.partial.missing, [3]);
  assert.equal(conflictsAt(corp.colleagues[2], TUE, 600, 30, corp)[0].title, "vacation");
});

test("a call longer than the working day has no answer at all", () => {
  const corp = base([{ name: "A" }]);
  const r = findCall(corp, { from: TUE, today: TUE, nowMin: 0, len: 10 * 60 });
  assert.equal(r.slot, null);
  assert.equal(r.partial, null);
});

test("day summary for the strip", () => {
  const corp = base([{ name: "A", blocks: [block("x", TUE, 9, 17.5)] }]);
  assert.deepEqual(daySummary(corp, TUE, TUE, 0, 30), { minutes: 30, fits: true });
  assert.deepEqual(daySummary(corp, TUE, TUE, 0, 45), { minutes: 30, fits: false });
});

test("sanitize: junk is dropped, never crashes", () => {
  assert.equal(sanitizeCorp(null), null);
  assert.equal(sanitizeCorp({ colleagues: [] }), null);
  assert.equal(sanitizeCorp({ colleagues: [{ name: "  " }] }), null);
  const c = sanitizeCorp({
    tz: "Mars/Olympus", day: { start: 900, end: 100 }, workdays: [9, "x"], lunch: { start: 0, end: 60 },
    colleagues: [
      7, { name: "A\u0000B".repeat(30), role: { x: 1 }, blocks: [
        { title: "ok", date: "2026-10-13", start: 600, end: 660, repeat: "hourly" },
        { title: "bad date", date: "2026-02-30", start: 600, end: 660 },
        { title: "backwards", date: "2026-10-13", start: 700, end: 600 },
        null,
      ] },
    ],
  }, "Europe/Belgrade");
  assert.equal(c.tz, "Europe/Belgrade");
  assert.deepEqual(c.day, { start: 540, end: 1080 });
  assert.deepEqual(c.workdays, [1, 2, 3, 4, 5]);
  assert.equal(c.lunch, null, "lunch outside the day is dropped");
  assert.equal(c.colleagues[0].name.length, 40);
  assert.equal(c.colleagues[0].role, "");
  assert.equal(c.colleagues[0].blocks.length, 1);
  assert.equal(c.colleagues[0].blocks[0].repeat, "once");
  assert.equal(c.colleagues[0].on, true);
});

test("share code roundtrip with emoji, Cyrillic, CJK and separators", () => {
  const corp = base([
    { name: "Аня, «дизайн» ~ 🎨", role: "Дизайн/UX", blocks: [block("Планёрка #1, срочно", TUE, 10, 10.25, "daily")] },
    { name: "王伟", role: "工程", on: false, blocks: [block("评审", TUE, 14, 15.5, "weekly")] },
    { name: "محمد", blocks: [] },
  ], { lunch: { start: 780, end: 840 }, workdays: [0, 1, 2, 3, 4] });
  const code = encodeCorp(corp);
  assert.match(code, /^c1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeCorp(code), corp);
  assert.ok(sameCorp(decodeCorp(code), corp));
  assert.equal(decodeCorp("c1.%%%"), null);
  assert.equal(decodeCorp("c1." + code.slice(3, 20)), null, "cut-off code");
  assert.equal(decodeCorp("v2.abc"), null);
});

test("old one-off meetings are pruned, recurring ones stay", () => {
  const corp = base([{ name: "A", blocks: [block("old", "2026-08-01", 10, 11), block("standup", "2026-08-01", 9, 9.25, "daily"), block("new", TUE, 10, 11)] }]);
  const p = pruneOld(corp, TUE);
  assert.deepEqual(p.colleagues[0].blocks.map(b => b.title), ["standup", "new"]);
  assert.equal(pruneOld(p, TUE), p, "unchanged → same object");
});

test("calendar file", () => {
  const ics = buildIcs({ title: "Call; a, b", date: "2026-11-02", start: 600, len: 45, tz: "Europe/Belgrade", description: "A\nB", now: new Date("2026-10-13T00:00:00Z") });
  assert.match(ics, /DTSTART:20261102T090000Z/);
  assert.match(ics, /DTEND:20261102T094500Z/);
  assert.match(ics, /SUMMARY:Call\\; a\\, b/);
  assert.match(ics, /DESCRIPTION:A\\nB/);
  assert.ok(ics.includes("\r\n"));
});
