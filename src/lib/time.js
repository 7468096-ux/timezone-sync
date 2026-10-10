/* ── pure time helpers (no React) ── */

export function hoursRange(start, end) {
  const arr = [];
  for (let i = start; i < end; i++) arr.push(i);
  return arr;
}

export const mod24 = (h) => ((h % 24) + 24) % 24;

const tzCache = new Map();
export function isValidTZ(tz) {
  if (typeof tz !== "string" || !tz) return false;
  if (tzCache.has(tz)) return tzCache.get(tz);
  let ok = true;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { ok = false; }
  tzCache.set(tz, ok);
  return ok;
}

const fmtCache = new Map();
function partsIn(tz, date) {
  let f = fmtCache.get(tz);
  if (!f) {
    // hourCycle h23: with hour12:false some engines print "24:05" after midnight
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  const o = {};
  for (const { type, value } of f.formatToParts(date)) o[type] = Number(value);
  return o;
}

export function getTimeInTZ(tz, date = new Date()) {
  const { hour, minute } = partsIn(tz, date);
  return { hours: hour, minutes: minute, decimal: hour + minute / 60 };
}

// UTC offset in hours (fractional for +5:30, +5:45, +9:30 …)
export function getOffset(tz, date = new Date()) {
  const p = partsIn(tz, date);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const truncated = Math.floor(date.getTime() / 60000) * 60000;
  return Math.round((asUTC - truncated) / 60000) / 60;
}

export function fmtOffset(off) {
  const sign = off < 0 ? "−" : "+";
  const a = Math.abs(off);
  const h = Math.floor(a);
  const m = Math.round((a - h) * 60);
  return `UTC${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

// Integer hour label, wraps around 24
export function fmtH(h) {
  return `${String(mod24(Math.round(h))).padStart(2, "0")}:00`;
}

// Decimal hours → HH:MM, keeps minutes for fractional offsets
export function fmtTime(h) {
  const total = Math.round(mod24(h) * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Local hour (integer) for a given reference hour and offset difference
export function localHourAt(refH, diff) {
  return Math.floor(mod24(refH + diff));
}

// −1 / 0 / +1: which calendar day the local time falls on relative to reference
export function dayShift(refH, diff) {
  return Math.floor((refH + diff) / 24);
}

export function fmtDayShift(shift) {
  return shift > 0 ? ` +${shift}д` : shift < 0 ? ` −${-shift}д` : "";
}

// Encode workHours as 24-bit hex (6 chars): bit i = hour i available
export function encodeHours(hours) {
  let mask = 0;
  hours.forEach(h => { mask |= (1 << h); });
  return mask.toString(16).padStart(6, "0");
}

export function decodeHours(hex) {
  if (typeof hex !== "string" || !/^[0-9a-f]{1,6}$/i.test(hex)) return null;
  const mask = parseInt(hex, 16);
  const hours = [];
  for (let i = 0; i < 24; i++) {
    if (mask & (1 << i)) hours.push(i);
  }
  return hours;
}

// Contiguous ranges of hours [start, end), treating 23→0 as contiguous.
// A range that crosses midnight has end > 24.
export function circularRanges(hours, n = 24) {
  const set = new Set(hours.filter(h => Number.isInteger(h) && h >= 0 && h < n));
  if (set.size === 0) return [];
  if (set.size === n) return [{ start: 0, end: n }];
  const sorted = [...set].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) { prev = sorted[i]; }
    else { ranges.push({ start, end: prev + 1 }); start = sorted[i]; prev = sorted[i]; }
  }
  ranges.push({ start, end: prev + 1 });
  if (ranges.length > 1 && ranges[0].start === 0 && ranges[ranges.length - 1].end === n) {
    const first = ranges.shift();
    ranges[ranges.length - 1].end = n + first.end;
  }
  return ranges;
}

export function describeHours(hours) {
  const ranges = circularRanges(hours);
  if (ranges.length === 0) return "—";
  return ranges.map(r => `${fmtH(r.start)}–${fmtH(r.end)}`).join(", ");
}

/* ── common window ── */

// Is the whole local span [refH+diff, refH+diff+1) inside the person's hours?
// With a fractional offset (+5:30 vs +2) it touches two local hours — both must be free.
export function coversRefHour(hourSet, refH, diff) {
  const start = mod24(refH + diff);
  const h = Math.floor(start);
  return hourSet.has(h) && (start === h || hourSet.has((h + 1) % 24));
}

// people: [{ offset, workHours }]; returns null or { ranges, best, allHours }
export function findCommonWindow(people, refOffset) {
  if (people.length === 0) return null;
  const sets = people.map(p => new Set(p.workHours));
  const allHours = [];
  for (let refH = 0; refH < 24; refH++) {
    if (people.every((p, i) => coversRefHour(sets[i], refH, p.offset - refOffset))) allHours.push(refH);
  }
  if (allHours.length === 0) return null;
  const ranges = circularRanges(allHours);
  const best = ranges.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  return { ranges, best, allHours };
}

// When nobody-left-out is impossible: hours where the most people are free.
// Returns null or { count, total, best: {start,end}, missing: [index…] at best.start }
export function findBestPartial(people, refOffset) {
  if (people.length === 0) return null;
  const sets = people.map(p => new Set(p.workHours));
  const freeAt = Array.from({ length: 24 }, (_, h) =>
    people.map((p, i) => coversRefHour(sets[i], h, p.offset - refOffset)));
  const counts = freeAt.map(f => f.filter(Boolean).length);
  const count = Math.max(...counts);
  if (count === 0) return null;
  // Split into runs where the *same* people are free, so the suggested range
  // really has `count` people free for its whole length.
  const sig = (h) => (counts[h] === count ? freeAt[h].map(Number).join("") : null);
  const runs = [];
  for (let h = 0; h < 24; h++) {
    if (sig(h) === null) continue;
    const last = runs[runs.length - 1];
    if (last && last.end === h && sig(last.start) === sig(h)) last.end = h + 1;
    else runs.push({ start: h, end: h + 1 });
  }
  if (runs.length > 1 && runs[0].start === 0 && runs[runs.length - 1].end === 24 && sig(0) === sig(23)) {
    runs[runs.length - 1].end = 24 + runs.shift().end;
  }
  const best = runs.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  const missing = freeAt[best.start].flatMap((f, i) => (f ? [] : [i]));
  return { count, total: people.length, best, missing };
}

// Is the person free for every hour of the reference slot [start, start+len)?
export function freeForSlot(hourSet, start, len, diff) {
  for (let k = 0; k < len; k++) if (!coversRefHour(hourSet, mod24(start + k), diff)) return false;
  return true;
}

/* ── half-hour model (used by the current interface; the hourly functions above serve v1) ──
   A person's availability is a set of local half-hours ("slots") 0..47: slot k = [k/2, k/2 + 0.5).
   Times are hours (may be fractional); a span is free only if every slot it touches is free. */
export const mod48 = (k) => ((k % 48) + 48) % 48;
export const slotsFromHours = (hours) => hours.flatMap(h => [2 * h, 2 * h + 1]);
export function hoursFromSlots(slots) {
  const s = new Set(slots);
  return hoursRange(0, 24).filter(h => s.has(2 * h) && s.has(2 * h + 1));
}

const EPS = 1e-9;
// local slots that the span [start, start + len) touches (start may be negative or ≥ 24)
export function slotsInSpan(start, len) {
  const out = [];
  for (let k = Math.floor(start * 2 + EPS); k < Math.ceil((start + len) * 2 - EPS); k++) out.push(mod48(k));
  return out;
}
export const coversSpan = (slotSet, start, len) => slotsInSpan(start, len).every(k => slotSet.has(k));

// Is the person (local slots, offset difference diff) free for the whole reference span?
export const freeForSpan = (slotSet, start, len, diff) => coversSpan(slotSet, start + diff, len);

const toHours = (r) => ({ start: r.start / 2, end: r.end / 2 });

// people: [{ offset, slotSet }]; → null | { ranges, best, allSlots } — ranges in reference hours,
// allSlots = reference half-hours (0..47) where everyone is free
export function findCommonSpan(people, refOffset) {
  if (people.length === 0) return null;
  const allSlots = [];
  for (let k = 0; k < 48; k++) {
    if (people.every(p => freeForSpan(p.slotSet, k / 2, 0.5, p.offset - refOffset))) allSlots.push(k);
  }
  if (allSlots.length === 0) return null;
  const ranges = circularRanges(allSlots, 48).map(toHours);
  const best = ranges.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  return { ranges, best, allSlots };
}

// No one-for-all time: where the most people are free, the same people for the whole range.
export function findBestPartialSpan(people, refOffset) {
  if (people.length === 0) return null;
  const freeAt = Array.from({ length: 48 }, (_, k) =>
    people.map(p => freeForSpan(p.slotSet, k / 2, 0.5, p.offset - refOffset)));
  const counts = freeAt.map(f => f.filter(Boolean).length);
  const count = Math.max(...counts);
  if (count === 0) return null;
  const sig = (k) => (counts[k] === count ? freeAt[k].map(Number).join("") : null);
  const runs = [];
  for (let k = 0; k < 48; k++) {
    if (sig(k) === null) continue;
    const last = runs[runs.length - 1];
    if (last && last.end === k && sig(last.start) === sig(k)) last.end = k + 1;
    else runs.push({ start: k, end: k + 1 });
  }
  if (runs.length > 1 && runs[0].start === 0 && runs[runs.length - 1].end === 48 && sig(0) === sig(47)) {
    runs[runs.length - 1].end = 48 + runs.shift().end;
  }
  const bestSlots = runs.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  const missing = freeAt[mod48(bestSlots.start)].flatMap((f, i) => (f ? [] : [i]));
  return { count, total: people.length, best: toHours(bestSlots), missing };
}

export function describeSlots(slots) {
  const ranges = circularRanges(slots, 48);
  if (ranges.length === 0) return "—";
  return ranges.map(r => `${fmtTime(r.start / 2)}–${fmtTime(r.end / 2)}`).join(", ");
}
