import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getOffset, getTimeInTZ, fmtTime, fmtOffset, circularRanges, findCommonWindow,
  hoursRange, dayShift, decodeHours, encodeHours, findBestPartial, freeForSlot,
} from "../src/lib/time.js";
import { encodeConfig, decodeConfig, sanitizePeople, DEFAULTS } from "../src/lib/config.js";

const JAN = new Date("2026-01-15T12:00:00Z");
const JUL = new Date("2026-07-15T12:00:00Z");

test("offsets: DST and fractional zones", () => {
  assert.equal(getOffset("Europe/Belgrade", JAN), 1);
  assert.equal(getOffset("Europe/Belgrade", JUL), 2);
  assert.equal(getOffset("America/Los_Angeles", JUL), -7);
  assert.equal(getOffset("Asia/Kolkata", JAN), 5.5);
  assert.equal(getOffset("Asia/Kathmandu", JAN), 5.75);
  assert.equal(fmtOffset(5.75), "UTC+5:45");
  assert.equal(fmtOffset(-7), "UTC−7");
});

test("time after midnight is 00, not 24", () => {
  assert.equal(getTimeInTZ("UTC", new Date("2026-01-15T00:05:00Z")).hours, 0);
});

test("fmtTime keeps half-hour offsets", () => {
  assert.equal(fmtTime(13 + 3.5), "16:30");
  assert.equal(fmtTime(-1.5), "22:30");
  assert.equal(fmtTime(24), "00:00");
});

test("circularRanges merges across midnight", () => {
  assert.deepEqual(circularRanges([22, 23, 0, 1, 5]), [{ start: 5, end: 6 }, { start: 22, end: 26 }]);
  assert.deepEqual(circularRanges(hoursRange(0, 24)), [{ start: 0, end: 24 }]);
  assert.deepEqual(circularRanges([]), []);
});

test("common window: picks longest, reports all ranges", () => {
  const people = [
    { offset: 0, workHours: [...hoursRange(8, 10), ...hoursRange(14, 18)] },
    { offset: 0, workHours: hoursRange(0, 24) },
  ];
  const w = findCommonWindow(people, 0);
  assert.deepEqual(w.best, { start: 14, end: 18 });
  assert.equal(w.ranges.length, 2);
  assert.equal(findCommonWindow([{ offset: 0, workHours: [] }], 0), null);
});

test("common window across midnight is one range", () => {
  // Tokyo (+9) 9–12 overlaps LA (−7) 16–19 → ref UTC 0–3; ref Belgrade(+1) 1–4
  const w = findCommonWindow([
    { offset: 9, workHours: hoursRange(9, 12) },
    { offset: 0, workHours: [22, 23, 0, 1, 2] },
  ], 0);
  assert.deepEqual(w.best, { start: 0, end: 3 });
  const w2 = findCommonWindow([{ offset: 0, workHours: [22, 23, 0, 1] }], 0);
  assert.deepEqual(w2.ranges, [{ start: 22, end: 26 }]);
});

test("dayShift", () => {
  assert.equal(dayShift(20, 9), 1);
  assert.equal(dayShift(3, -7), -1);
  assert.equal(dayShift(12, 2), 0);
});

test("hours hex roundtrip and validation", () => {
  assert.deepEqual(decodeHours(encodeHours([0, 9, 23])), [0, 9, 23]);
  assert.equal(decodeHours("zz"), null);
});

test("share link roundtrip, incl. separators in names", () => {
  const people = sanitizePeople([
    { name: "Иван, PM~lead", city: "Нови Сад.", tz: "Europe/Belgrade", workHours: [9, 10, 14] },
    { name: "Kathmandu", city: "", tz: "Asia/Kathmandu", workHours: hoursRange(10, 18) },
  ]);
  const back = decodeConfig(encodeConfig(people));
  assert.deepEqual(back, people);
});

test("share link survives a hash that arrives already decoded (Firefox, messengers)", () => {
  const h = encodeConfig(DEFAULTS);
  assert.deepEqual(decodeConfig(decodeURI(h)), decodeConfig(h));
});

test("legacy links still decode", () => {
  const v1 = encodeURIComponent("Ты~Belgrade~8~1ffe00,Bob~NY~0~9~18");
  const d = decodeConfig(v1);
  assert.equal(d[0].tz, "Europe/Belgrade");
  assert.deepEqual(d[0].workHours, hoursRange(9, 21));
  assert.equal(d[1].tz, "America/New_York");
  assert.deepEqual(d[1].workHours, hoursRange(9, 18));
  const b64 = btoa(encodeURIComponent(JSON.stringify([{ n: "A", c: "B", z: "Asia/Tokyo", s: 9, e: 12 }])));
  assert.deepEqual(decodeConfig(b64)[0].workHours, [9, 10, 11]);
});

test("invalid data is dropped instead of crashing the app", () => {
  assert.equal(decodeConfig("v2.X~Y~Foo%2FBar~0003fe"), null);
  assert.equal(decodeConfig("garbage%%%"), null);
  const s = sanitizePeople([{ name: "ok", tz: "US/Eastern", workHours: [9, 9, 30, -1, "x"] }, null, { tz: "nope" }]);
  assert.equal(s.length, 1);
  assert.equal(s[0].tz, "America/New_York");
  assert.deepEqual(s[0].workHours, [9]);
  // old localStorage shape
  assert.deepEqual(sanitizePeople([{ name: "a", tz: "UTC", workStart: 10, workEnd: 12 }])[0].workHours, [10, 11]);
});

test("legacy zone aliases reported by browsers are normalized", () => {
  assert.equal(sanitizePeople([{ name: "a", tz: "Asia/Calcutta", workHours: [] }])[0].tz, "Asia/Kolkata");
});

test("fractional offset: window must fit fully into everyone's hours", () => {
  // Mumbai ref (+5.5), Berlin (+2) works 9–18: ref 21:00 = Berlin 17:30–18:30 → not fully free
  const berlin = { offset: 2, workHours: hoursRange(9, 18) };
  const mumbai = { offset: 5.5, workHours: hoursRange(0, 24) };
  const w = findCommonWindow([berlin, mumbai], 5.5);
  assert.deepEqual(w.best, { start: 13, end: 21 }); // Berlin 09:30–17:30
});

test("best partial window names who can't make it", () => {
  const people = [
    { offset: 0, workHours: hoursRange(9, 12) },
    { offset: 0, workHours: hoursRange(10, 14) },
    { offset: 0, workHours: hoursRange(20, 22) },
  ];
  const r = findBestPartial(people, 0);
  assert.equal(r.count, 2);
  assert.deepEqual(r.best, { start: 10, end: 12 });
  assert.deepEqual(r.missing, [2]);
});

test("freeForSlot checks every hour and wraps midnight", () => {
  const s = new Set([22, 23, 0]);
  assert.equal(freeForSlot(s, 22, 3, 0), true);
  assert.equal(freeForSlot(s, 22, 4, 0), false);
});

test("best partial range keeps the same people free throughout", () => {
  // A 9–13, B 13–17, C 9–17: 2 of 3 free from 9 to 17, but A+C then B+C
  const people = [
    { offset: 0, workHours: hoursRange(9, 13) },
    { offset: 0, workHours: hoursRange(13, 17) },
    { offset: 0, workHours: hoursRange(9, 17) },
  ];
  const r = findBestPartial(people, 0);
  assert.deepEqual(r.best, { start: 9, end: 13 });
  assert.deepEqual(r.missing, [1]);
});

test("sync: key parsing and end-to-end encryption roundtrip", async () => {
  const { newKey, parseKey, encryptPayload, decryptPayload } = await import("../src/lib/sync.js");
  const k = newKey();
  assert.match(k, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(parseKey(`https://x.github.io/timezone-sync/#sync.${k}`), k);
  assert.equal(parseKey(`  ${k} `), k);
  assert.equal(parseKey("v2.Ann~Paris~5~0003fe"), null);
  const payload = { people: [{ id: 1, name: "Аня", tz: "Europe/Paris", workHours: [9, 10] }] };
  const box = await encryptPayload(k, payload);
  assert.ok(!box.data.includes("Аня") && !atob(box.data).includes("Paris"));
  assert.deepEqual(await decryptPayload(k, box), payload);
  await assert.rejects(() => decryptPayload(newKey(), box)); // wrong key can't read it
});
