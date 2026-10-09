/* ── timezones, share-link format, validation ── */
import { hoursRange, isValidTZ, encodeHours, decodeHours, getOffset } from "./time.js";

// ORDER IS PART OF THE SHARE-LINK FORMAT: links store the index into this list.
// Only append new entries, never reorder or remove.
const TZ_TABLE = [
  ["New York", "America/New_York"], ["Chicago", "America/Chicago"], ["Los Angeles", "America/Los_Angeles"],
  ["São Paulo", "America/Sao_Paulo"], ["London", "Europe/London"], ["Paris", "Europe/Paris"],
  ["Amsterdam", "Europe/Amsterdam"], ["Berlin", "Europe/Berlin"], ["Belgrade", "Europe/Belgrade"],
  ["Zurich", "Europe/Zurich"], ["Moscow", "Europe/Moscow"], ["Dubai", "Asia/Dubai"],
  ["Mumbai", "Asia/Kolkata"], ["Singapore", "Asia/Singapore"], ["Shanghai", "Asia/Shanghai"],
  ["Seoul", "Asia/Seoul"], ["Tokyo", "Asia/Tokyo"], ["Sydney", "Australia/Sydney"],
  ["Auckland", "Pacific/Auckland"],
  // appended later
  ["Denver", "America/Denver"], ["Toronto", "America/Toronto"], ["Mexico City", "America/Mexico_City"],
  ["Lisbon", "Europe/Lisbon"], ["Madrid", "Europe/Madrid"], ["Warsaw", "Europe/Warsaw"],
  ["Kyiv", "Europe/Kyiv"], ["Istanbul", "Europe/Istanbul"], ["Tbilisi", "Asia/Tbilisi"],
  ["Yerevan", "Asia/Yerevan"], ["Almaty", "Asia/Almaty"], ["Tashkent", "Asia/Tashkent"],
  ["Bangkok", "Asia/Bangkok"], ["Hong Kong", "Asia/Hong_Kong"],
];
const TZ_INDEX = TZ_TABLE.map(([, tz]) => tz);
// Old browsers may not know newer names (e.g. Europe/Kyiv) — hide those from the UI
export const COMMON_TZ = TZ_TABLE.filter(([, tz]) => isValidTZ(tz));

// Old saves/links used deprecated aliases
// (some browsers still report e.g. Asia/Calcutta as the detected zone)
const TZ_ALIASES = {
  "US/Eastern": "America/New_York", "US/Central": "America/Chicago", "US/Mountain": "America/Denver",
  "US/Pacific": "America/Los_Angeles", "Europe/Kiev": "Europe/Kyiv", "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu", "Asia/Saigon": "Asia/Ho_Chi_Minh", "Asia/Rangoon": "Asia/Yangon",
};
export const normalizeTZ = (tz) => TZ_ALIASES[tz] || tz;

const FLAG_MAP = {
  "America/New_York": "🇺🇸", "America/Chicago": "🇺🇸", "America/Los_Angeles": "🇺🇸", "America/Denver": "🇺🇸",
  "America/Toronto": "🇨🇦", "America/Mexico_City": "🇲🇽", "America/Sao_Paulo": "🇧🇷",
  "Europe/London": "🇬🇧", "Europe/Paris": "🇫🇷", "Europe/Berlin": "🇩🇪", "Europe/Belgrade": "🇷🇸",
  "Europe/Zurich": "🇨🇭", "Europe/Moscow": "🇷🇺", "Europe/Amsterdam": "🇳🇱", "Europe/Lisbon": "🇵🇹",
  "Europe/Madrid": "🇪🇸", "Europe/Warsaw": "🇵🇱", "Europe/Kyiv": "🇺🇦", "Europe/Istanbul": "🇹🇷",
  "Asia/Dubai": "🇦🇪", "Asia/Kolkata": "🇮🇳", "Asia/Shanghai": "🇨🇳", "Asia/Tokyo": "🇯🇵",
  "Asia/Seoul": "🇰🇷", "Asia/Singapore": "🇸🇬", "Asia/Tbilisi": "🇬🇪", "Asia/Yerevan": "🇦🇲",
  "Asia/Almaty": "🇰🇿", "Asia/Tashkent": "🇺🇿", "Asia/Bangkok": "🇹🇭", "Asia/Hong_Kong": "🇭🇰",
  "Australia/Sydney": "🇦🇺", "Pacific/Auckland": "🇳🇿",
};
export const flagFor = (tz) => FLAG_MAP[normalizeTZ(tz)] || "🌍";

export function cityFor(tz) {
  const entry = COMMON_TZ.find(([, v]) => v === tz);
  return entry ? entry[0] : tz.split("/").pop().replace(/_/g, " ");
}

// All IANA zones the browser knows (for "other" in the selects)
export function allTimeZones() {
  try { return Intl.supportedValuesOf("timeZone"); } catch { return []; }
}

// COMMON_TZ sorted by current offset, for display
export function sortedCommonTZ(date = new Date()) {
  return COMMON_TZ
    .map(([label, tz]) => ({ label, tz, offset: getOffset(tz, date) }))
    .sort((a, b) => a.offset - b.offset || a.label.localeCompare(b.label));
}

export const DEFAULTS = [
  { id: 1, name: "Ты", city: "Belgrade", tz: "Europe/Belgrade", emoji: "🇷🇸", workHours: hoursRange(9, 21) },
  { id: 2, name: "Берлин", city: "Berlin", tz: "Europe/Berlin", emoji: "🇩🇪", workHours: hoursRange(9, 18) },
  { id: 3, name: "Сценарист", city: "Zürich", tz: "Europe/Zurich", emoji: "🇨🇭", workHours: hoursRange(10, 19) },
  { id: 4, name: "Агентство", city: "San Francisco", tz: "America/Los_Angeles", emoji: "🇺🇸", workHours: hoursRange(8, 18) },
];

export const MAX_PEOPLE = 30;
const MAX_TEXT = 40;

/* ── validation: everything loaded from URL / localStorage goes through here ── */
export function sanitizePeople(arr) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const raw of arr.slice(0, MAX_PEOPLE)) {
    if (!raw || typeof raw !== "object") continue;
    const tz = normalizeTZ(String(raw.tz ?? ""));
    if (!isValidTZ(tz)) continue;
    let hours = raw.workHours;
    if (!Array.isArray(hours)) {
      const s = Number.isInteger(raw.workStart) ? raw.workStart : 9;
      const e = Number.isInteger(raw.workEnd) ? raw.workEnd : 18;
      hours = hoursRange(Math.max(0, s), Math.min(24, e));
    }
    hours = [...new Set(hours.filter(h => Number.isInteger(h) && h >= 0 && h < 24))].sort((a, b) => a - b);
    const city = String(raw.city ?? "").trim().slice(0, MAX_TEXT) || cityFor(tz);
    const name = String(raw.name ?? "").trim().slice(0, MAX_TEXT) || city;
    out.push({ id: out.length + 1, name, city, tz, emoji: flagFor(tz), workHours: hours });
  }
  return out.length ? out : null;
}

/* ── share-link format ──
   v2: "v2." + people joined by ","; fields joined by "~"; text fields percent-encoded
       (so "," and "~" inside names are safe). tz = index in TZ_INDEX or raw IANA name.
   legacy (still decoded): encodeURIComponent("name~city~tz~hex,…"), 5-field start/end
       variant, and base64(JSON). */
const esc = (s) => encodeURIComponent(s).replace(/~/g, "%7E").replace(/\./g, "%2E");
const unesc = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

export function encodeConfig(people) {
  return "v2." + people.map(p => {
    const zi = TZ_INDEX.indexOf(normalizeTZ(p.tz));
    const tz = zi >= 0 ? String(zi) : esc(p.tz);
    return [esc(p.name), esc(p.city), tz, encodeHours(p.workHours)].join("~");
  }).join(",");
}

const tzFromToken = (t) => (/^\d+$/.test(t) && Number(t) < TZ_INDEX.length ? TZ_INDEX[Number(t)] : t);

export function decodeConfig(hash) {
  try {
    if (!hash) return null;
    if (hash.startsWith("v2.")) {
      return sanitizePeople(hash.slice(3).split(",").map(part => {
        const [name, city, tz, hex] = part.split("~");
        return { name: unesc(name ?? ""), city: unesc(city ?? ""), tz: tzFromToken(unesc(tz ?? "")), workHours: decodeHours(hex) ?? [] };
      }));
    }
    const decoded = unesc(hash);
    if (decoded.includes("~")) {
      return sanitizePeople(decoded.split(",").map(part => {
        const segs = part.split("~");
        const [name, city, tzRaw] = segs;
        const workHours = segs.length === 5
          ? hoursRange(parseInt(segs[3], 10), parseInt(segs[4], 10))
          : decodeHours(segs[3]) ?? [];
        return { name, city, tz: tzFromToken(tzRaw ?? ""), workHours };
      }));
    }
    const arr = JSON.parse(unesc(atob(hash)));
    return sanitizePeople(arr.map(p => ({
      name: p.n, city: p.c, tz: p.z,
      workHours: (p.h && decodeHours(p.h)) || hoursRange(p.s, p.e),
    })));
  } catch { return null; }
}
