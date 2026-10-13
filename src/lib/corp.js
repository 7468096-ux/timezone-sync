/* ── "Company" mode: one organisation, one time zone, colleagues' meetings ──
   Pure logic, no React. Times are minutes from local midnight in the company time zone (0..1440);
   dates are calendar dates "YYYY-MM-DD" in that zone. Calendar maths runs on UTC day numbers, so
   daylight-saving changes never shift a date or a meeting.

   corp = {
     tz: "Europe/Belgrade",
     day: { start: 540, end: 1080 },        // working day 09:00–18:00
     workdays: [1, 2, 3, 4, 5],             // 0 = Sunday … 6 = Saturday
     lunch: { start: 780, end: 840 } | null,
     colleagues: [{ id, name, role, on, blocks: [{ id, title, date, start, end, repeat }] }],
   }
   on: invited to the call being planned. repeat: "once" | "daily" (every workday from date) | "weekly". */
import { isValidTZ, getOffset } from "./time.js";
import { normalizeTZ } from "./config.js";

export const STEP = 15;                 // grid and search step, minutes
export const MAX_COLLEAGUES = 30;
export const MAX_BLOCKS = 60;           // per colleague
export const MAX_CALL = 8 * 60;
export const HORIZON = 14;              // days searched ahead
export const REPEATS = ["once", "daily", "weekly"];
const MAX_TEXT = 40;

/* ── calendar dates ── */
const DAY_MS = 864e5;
export const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && dateFromNum(dayNum(s)) === s;
export function dayNum(s) {
  const [y, m, d] = s.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
export function dateFromNum(n) {
  const d = new Date(n * DAY_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export const addDays = (s, n) => dateFromNum(dayNum(s) + n);
export const weekday = (s) => new Date(dayNum(s) * DAY_MS).getUTCDay();
// A Date at noon UTC of that calendar day: format it with timeZone "UTC" to print the date itself
export const dateAsUTC = (s) => new Date(dayNum(s) * DAY_MS + 12 * 3600e3);

const partsFmt = new Map();
function parts(tz, date) {
  let f = partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    partsFmt.set(tz, f);
  }
  const o = {};
  for (const { type, value } of f.formatToParts(date)) o[type] = Number(value);
  return o;
}
// Today's date and the minute of the day in the company zone
export function nowIn(tz, now = new Date()) {
  const p = parts(tz, now);
  return { date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`, min: p.hour * 60 + p.minute };
}
// Local date + minute in tz → the real instant (ms). Two passes settle the offset around DST changes.
export function toInstant(date, min, tz) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d) + min * 60e3;
  const t1 = guess - getOffset(tz, new Date(guess)) * 3600e3;
  return guess - getOffset(tz, new Date(t1)) * 3600e3;
}

export const fmtMin = (min) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return min === 1440 ? "24:00" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const ceilStep = (m) => Math.ceil(m / STEP) * STEP;

/* ── which meetings happen on a date ── */
export function occursOn(block, date, workdays) {
  if (block.repeat === "once") return block.date === date;
  if (date < block.date) return false;
  if (block.repeat === "daily") return workdays.includes(weekday(date));
  return weekday(date) === weekday(block.date); // weekly
}

export function busyOn(colleague, date, corp) {
  return colleague.blocks
    .filter(b => occursOn(b, date, corp.workdays))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

// Why a colleague can't make [start, start + len) on date: meetings in the way (empty = free)
export function conflictsAt(colleague, date, start, len, corp) {
  return busyOn(colleague, date, corp).filter(b => overlaps(start, start + len, b.start, b.end));
}

// Everything that rules a span out for the whole company: not a workday, outside the day, lunch, the past
export function spanAllowed(corp, date, start, len, today, nowMin) {
  if (!corp.workdays.includes(weekday(date))) return false;
  if (start < corp.day.start || start + len > corp.day.end) return false;
  if (corp.lunch && overlaps(start, start + len, corp.lunch.start, corp.lunch.end)) return false;
  if (date < today || (date === today && start < nowMin)) return false;
  return true;
}

// Free intervals shared by the given colleagues on one date (work day minus lunch, past and meetings)
export function commonFree(corp, date, people, today, nowMin) {
  if (!corp.workdays.includes(weekday(date)) || date < today) return [];
  let free = [{ start: corp.day.start, end: corp.day.end }];
  const cut = (s, e) => {
    free = free.flatMap(f => {
      if (!overlaps(f.start, f.end, s, e)) return [f];
      const out = [];
      if (f.start < s) out.push({ start: f.start, end: s });
      if (e < f.end) out.push({ start: e, end: f.end });
      return out;
    });
  };
  if (corp.lunch) cut(corp.lunch.start, corp.lunch.end);
  if (date === today) cut(0, nowMin);
  for (const p of people) for (const b of busyOn(p, date, corp)) cut(b.start, b.end);
  return free;
}

// Workdays from `from` (inclusive) within `days` calendar days
export function workdaysAhead(corp, from, days = HORIZON) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    if (corp.workdays.includes(weekday(d))) out.push(d);
  }
  return out;
}

/* ── the answer ──
   findCall(corp, { from, today, nowMin, len }) →
     { invited, windows: [{date, start, end}], slot: {date, start, len} | null,
       partial: { slot, count, total, missing: [id…] } | null }
   windows: shared free time long enough for the call, earliest first; slot: the earliest start
   (on the 15-minute grid). partial: when no window exists, the earliest start with the most invited free. */
export function findCall(corp, { from, today, nowMin, len, days = HORIZON }) {
  const invited = corp.colleagues.filter(c => c.on);
  const result = { invited, windows: [], slot: null, partial: null };
  if (invited.length === 0) return result;
  const start = from < today ? today : from;
  const dates = workdaysAhead(corp, start, days);
  for (const date of dates) {
    for (const f of commonFree(corp, date, invited, today, nowMin)) {
      const s = ceilStep(f.start);
      if (s + len <= f.end) result.windows.push({ date, start: s, end: f.end });
    }
  }
  if (result.windows.length) {
    const w = result.windows[0];
    result.slot = { date: w.date, start: w.start, len };
    return result;
  }
  // nobody-left-out is impossible: the earliest start where the most invited people are free
  let best = null;
  for (const date of dates) {
    for (let s = ceilStep(corp.day.start); s + len <= corp.day.end; s += STEP) {
      if (!spanAllowed(corp, date, s, len, today, nowMin)) continue;
      const missing = invited.filter(c => conflictsAt(c, date, s, len, corp).length).map(c => c.id);
      const count = invited.length - missing.length;
      if (count > 0 && (!best || count > best.count)) best = { slot: { date, start: s, len }, count, total: invited.length, missing };
    }
  }
  result.partial = best;
  return result;
}

// Per date: shared free minutes and whether a call of `len` fits (for the day strip)
export function daySummary(corp, date, today, nowMin, len) {
  const invited = corp.colleagues.filter(c => c.on);
  if (!invited.length) return { minutes: 0, fits: false };
  const free = commonFree(corp, date, invited, today, nowMin);
  return {
    minutes: free.reduce((a, f) => a + f.end - f.start, 0),
    fits: free.some(f => ceilStep(f.start) + len <= f.end),
  };
}

/* ── validation: everything from links, storage and sync goes through here ── */
const text = (v) => (typeof v === "string" || typeof v === "number" ? String(v) : "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, MAX_TEXT);
const minute = (v, lo = 0, hi = 1440) => {
  const n = Math.round(Number(v) / 5) * 5;
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null;
};
function span(raw, fallback) {
  if (!raw || typeof raw !== "object") return fallback;
  const s = minute(raw.start), e = minute(raw.end);
  return s !== null && e !== null && e > s ? { start: s, end: e } : fallback;
}

export const DEFAULT_DAY = { start: 9 * 60, end: 18 * 60 };
export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];

export function sanitizeCorp(raw, fallbackTZ = "UTC") {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.colleagues)) return null;
  const tz = normalizeTZ(String(raw.tz ?? ""));
  const workdays = Array.isArray(raw.workdays)
    ? [...new Set(raw.workdays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [];
  const day = span(raw.day, DEFAULT_DAY);
  const lunch = raw.lunch ? span(raw.lunch, null) : null;
  const colleagues = [];
  for (const c of raw.colleagues.slice(0, MAX_COLLEAGUES)) {
    if (!c || typeof c !== "object") continue;
    const blocks = [];
    for (const b of Array.isArray(c.blocks) ? c.blocks : []) {
      if (blocks.length >= MAX_BLOCKS) break;
      if (!b || typeof b !== "object" || !isDate(b.date)) continue;
      const t = span(b, null);
      if (!t) continue;
      blocks.push({ id: blocks.length + 1, title: text(b.title), date: b.date, ...t, repeat: REPEATS.includes(b.repeat) ? b.repeat : "once" });
    }
    const name = text(c.name);
    if (!name) continue;
    colleagues.push({ id: colleagues.length + 1, name, role: text(c.role), on: c.on !== false, blocks });
  }
  if (!colleagues.length) return null;
  return {
    tz: isValidTZ(tz) ? tz : fallbackTZ,
    day,
    workdays: workdays.length ? workdays : DEFAULT_WORKDAYS,
    lunch: lunch && lunch.start >= day.start && lunch.end <= day.end ? lunch : null,
    colleagues,
  };
}

// One-off meetings long past only take space in links and storage
export function pruneOld(corp, today, keepDays = 30) {
  const limit = addDays(today, -keepDays);
  let changed = false;
  const colleagues = corp.colleagues.map(c => {
    const blocks = c.blocks.filter(b => b.repeat !== "once" || b.date >= limit);
    if (blocks.length !== c.blocks.length) changed = true;
    return blocks.length === c.blocks.length ? c : { ...c, blocks };
  });
  return changed ? { ...corp, colleagues } : corp;
}

export const nextIdOf = (list) => Math.max(0, ...list.map(x => x.id)) + 1;

/* ── share format ──
   "c1." + base64url(UTF-8 JSON) with short keys; formats are forever — only add new prefixes.
   { z: tz, d: [start, end], w: "12345", l: [start, end] | 0,
     c: [[name, role, on 1|0, [[title, "YYYY-MM-DD", start, end, repeat 0|1|2], …]], …] } */
const b64urlEncode = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlDecode = (s) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
};

export function encodeCorp(corp) {
  return "c1." + b64urlEncode(JSON.stringify({
    z: corp.tz,
    d: [corp.day.start, corp.day.end],
    w: corp.workdays.join(""),
    l: corp.lunch ? [corp.lunch.start, corp.lunch.end] : 0,
    c: corp.colleagues.map(c => [c.name, c.role, c.on ? 1 : 0,
      c.blocks.map(b => [b.title, b.date, b.start, b.end, REPEATS.indexOf(b.repeat)])]),
  }));
}

export function decodeCorp(code) {
  try {
    if (typeof code !== "string" || !code.startsWith("c1.")) return null;
    const o = JSON.parse(b64urlDecode(code.slice(3)));
    if (!o || !Array.isArray(o.c)) return null;
    const pair = (a) => (Array.isArray(a) ? { start: a[0], end: a[1] } : null);
    return sanitizeCorp({
      tz: o.z,
      day: pair(o.d),
      workdays: String(o.w ?? "").split("").map(Number),
      lunch: pair(o.l),
      colleagues: o.c.map(c => (Array.isArray(c) ? {
        name: c[0], role: c[1], on: c[2] !== 0,
        blocks: (Array.isArray(c[3]) ? c[3] : []).map(b => (Array.isArray(b)
          ? { title: b[0], date: b[1], start: b[2], end: b[3], repeat: REPEATS[b[4]] } : null)),
      } : null)),
    });
  } catch { return null; }
}

export const sameCorp = (a, b) => !!a && !!b && encodeCorp(a) === encodeCorp(b);

/* ── calendar file (.ics) for the chosen call ── */
const icsTime = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
export function buildIcs({ title, date, start, len, tz, description = "", now = new Date(), uid }) {
  const from = toInstant(date, start, tz);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Timezone Sync//Company//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid || `${from}-${start}-${len}@timezone-sync.com.co`}`,
    `DTSTAMP:${icsTime(now.getTime())}`,
    `DTSTART:${icsTime(from)}`,
    `DTEND:${icsTime(from + len * 60e3)}`,
    `SUMMARY:${icsText(title)}`,
    ...(description ? [`DESCRIPTION:${icsText(description)}`] : []),
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}
