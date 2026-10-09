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
export function circularRanges(hours) {
  const set = new Set(hours.filter(h => Number.isInteger(h) && h >= 0 && h < 24));
  if (set.size === 0) return [];
  if (set.size === 24) return [{ start: 0, end: 24 }];
  const sorted = [...set].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) { prev = sorted[i]; }
    else { ranges.push({ start, end: prev + 1 }); start = sorted[i]; prev = sorted[i]; }
  }
  ranges.push({ start, end: prev + 1 });
  if (ranges.length > 1 && ranges[0].start === 0 && ranges[ranges.length - 1].end === 24) {
    const first = ranges.shift();
    ranges[ranges.length - 1].end = 24 + first.end;
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
