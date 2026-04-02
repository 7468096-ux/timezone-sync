import { useState, useEffect, useMemo, useRef, useCallback } from "react";

/* ── defaults ── */
function hoursRange(start, end) {
  const arr = [];
  for (let i = start; i < end; i++) arr.push(i);
  return arr;
}

const DEFAULTS = [
  { id: 1, name: "Ты", city: "Belgrade", tz: "Europe/Belgrade", emoji: "🇷🇸", workHours: hoursRange(9, 21) },
  { id: 2, name: "Берлин", city: "Berlin", tz: "Europe/Berlin", emoji: "🇩🇪", workHours: hoursRange(9, 18) },
  { id: 3, name: "Сценарист", city: "Zürich", tz: "Europe/Zurich", emoji: "🇨🇭", workHours: hoursRange(10, 19) },
  { id: 4, name: "Агентство", city: "San Francisco", tz: "America/Los_Angeles", emoji: "🇺🇸", workHours: hoursRange(9, 18) },
];

const FLAG_MAP = {
  "US/Eastern": "🇺🇸", "US/Central": "🇺🇸", "America/Los_Angeles": "🇺🇸",
  "America/Sao_Paulo": "🇧🇷", "Europe/London": "🇬🇧", "Europe/Paris": "🇫🇷",
  "Europe/Berlin": "🇩🇪", "Europe/Belgrade": "🇷🇸", "Europe/Zurich": "🇨🇭",
  "Europe/Moscow": "🇷🇺", "Asia/Dubai": "🇦🇪", "Asia/Kolkata": "🇮🇳",
  "Asia/Shanghai": "🇨🇳", "Asia/Tokyo": "🇯🇵", "Australia/Sydney": "🇦🇺",
  "Asia/Seoul": "🇰🇷", "Asia/Singapore": "🇸🇬", "Europe/Amsterdam": "🇳🇱",
  "Pacific/Auckland": "🇳🇿",
};

const COMMON_TZ = [
  ["US Eastern", "US/Eastern"], ["US Central", "US/Central"], ["US Pacific", "America/Los_Angeles"],
  ["São Paulo", "America/Sao_Paulo"], ["London", "Europe/London"], ["Paris", "Europe/Paris"],
  ["Amsterdam", "Europe/Amsterdam"], ["Berlin", "Europe/Berlin"], ["Belgrade", "Europe/Belgrade"],
  ["Zurich", "Europe/Zurich"], ["Moscow", "Europe/Moscow"], ["Dubai", "Asia/Dubai"],
  ["Mumbai", "Asia/Kolkata"], ["Singapore", "Asia/Singapore"], ["Shanghai", "Asia/Shanghai"],
  ["Seoul", "Asia/Seoul"], ["Tokyo", "Asia/Tokyo"], ["Sydney", "Australia/Sydney"],
  ["Auckland", "Pacific/Auckland"],
];

/* ── helpers ── */
function getTimeInTZ(tz) {
  const d = new Date();
  const s = d.toLocaleString("en-US", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" });
  const [h, m] = s.split(":").map(Number);
  return { hours: h, minutes: m, decimal: h + m / 60 };
}

function getOffset(tz) {
  const n = new Date();
  const u = n.toLocaleString("en-US", { timeZone: "UTC" });
  const t = n.toLocaleString("en-US", { timeZone: tz });
  return (new Date(t) - new Date(u)) / 3600000;
}

function fmtH(h) {
  const hh = ((Math.round(h) % 24) + 24) % 24;
  return `${hh.toString().padStart(2, "0")}:00`;
}

// Encode workHours as 24-bit hex (6 chars): bit i = hour i available
function encodeHours(hours) {
  let mask = 0;
  hours.forEach(h => { mask |= (1 << h); });
  return mask.toString(16).padStart(6, "0");
}

function decodeHours(hex) {
  const mask = parseInt(hex, 16);
  const hours = [];
  for (let i = 0; i < 24; i++) {
    if (mask & (1 << i)) hours.push(i);
  }
  return hours;
}

function describeHours(hours) {
  if (hours.length === 0) return "—";
  const sorted = [...hours].sort((a, b) => a - b);
  // Find contiguous ranges
  const ranges = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) { prev = sorted[i]; }
    else { ranges.push([start, prev + 1]); start = sorted[i]; prev = sorted[i]; }
  }
  ranges.push([start, prev + 1]);
  return ranges.map(([s, e]) => `${fmtH(s)}–${fmtH(e)}`).join(", ");
}

/* ── URL hash encode/decode ── */
const TZ_LIST = COMMON_TZ.map(([, v]) => v);

function encodeConfig(people) {
  const parts = people.map(p => {
    const zi = TZ_LIST.indexOf(p.tz);
    const tz = zi >= 0 ? zi : p.tz;
    return `${p.name}~${p.city}~${tz}~${encodeHours(p.workHours)}`;
  });
  return encodeURIComponent(parts.join(","));
}

function decodeConfig(hash) {
  try {
    const decoded = decodeURIComponent(hash);
    if (decoded.includes("~")) {
      const parts = decoded.split(",");
      return parts.map((part, i) => {
        const segs = part.split("~");
        const [name, city, tzRaw] = segs;
        const tzIdx = parseInt(tzRaw);
        const tz = !isNaN(tzIdx) && tzIdx < TZ_LIST.length ? TZ_LIST[tzIdx] : tzRaw;
        let workHours;
        if (segs.length === 5) {
          // Old format: name~city~tz~start~end
          workHours = hoursRange(parseInt(segs[3]), parseInt(segs[4]));
        } else {
          // New format: name~city~tz~hexHours
          workHours = decodeHours(segs[3]);
        }
        return { id: i + 1, name, city, tz, emoji: FLAG_MAP[tz] || "🌍", workHours };
      });
    }
    // Fallback: old base64+JSON format
    const json = decodeURIComponent(atob(hash));
    const arr = JSON.parse(json);
    return arr.map((p, i) => ({
      id: i + 1, name: p.n, city: p.c, tz: p.z,
      emoji: FLAG_MAP[p.z] || "🌍",
      workHours: p.h ? decodeHours(p.h) : hoursRange(p.s, p.e),
    }));
  } catch { return null; }
}

// Migrate old format (workStart/workEnd) to new (workHours)
function migratePerson(p) {
  if (p.workHours) return p;
  return { ...p, workHours: hoursRange(p.workStart || 9, p.workEnd || 18) };
}

function loadPeople() {
  const hash = window.location.hash.slice(1);
  if (hash) {
    const fromUrl = decodeConfig(hash);
    if (fromUrl && fromUrl.length > 0) return fromUrl.map(migratePerson);
  }
  try {
    const saved = localStorage.getItem("tz-sync-people");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(migratePerson);
    }
  } catch {}
  return DEFAULTS;
}

/* ── component ── */
export default function App() {
  const [now, setNow] = useState(new Date());
  const [people, setPeople] = useState(loadPeople);
  const [hoveredHour, setHoveredHour] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newTz, setNewTz] = useState("US/Eastern");
  const [copied, setCopied] = useState(false);
  const tlRefs = useRef({});

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  const detectedTZ = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    catch { return "Europe/Belgrade"; }
  }, []);

  const [refTZ, setRefTZ] = useState(() => {
    try {
      const saved = localStorage.getItem("tz-sync-ref");
      if (saved && COMMON_TZ.some(([, v]) => v === saved)) return saved;
    } catch {}
    return COMMON_TZ.find(([, v]) => v === detectedTZ)?.[1] || detectedTZ;
  });

  useEffect(() => {
    try { localStorage.setItem("tz-sync-ref", refTZ); } catch {}
  }, [refTZ]);

  const userTZ = refTZ;
  const userCity = useMemo(() => {
    const entry = COMMON_TZ.find(([, v]) => v === userTZ);
    if (entry) return entry[0];
    return userTZ.split("/").pop().replace(/_/g, " ");
  }, [userTZ]);
  const refOffset = getOffset(userTZ);

  useEffect(() => {
    try { localStorage.setItem("tz-sync-people", JSON.stringify(people)); } catch {}
  }, [people]);

  // Toggle hour for a person (in their local time)
  const toggleHour = useCallback((pid, localHour) => {
    setPeople(prev => prev.map(p => {
      if (p.id !== pid) return p;
      const has = p.workHours.includes(localHour);
      const newHours = has
        ? p.workHours.filter(h => h !== localHour)
        : [...p.workHours, localHour].sort((a, b) => a - b);
      return { ...p, workHours: newHours };
    }));
  }, []);

  const enriched = useMemo(() =>
    people.map(p => ({ ...p, time: getTimeInTZ(p.tz), offset: getOffset(p.tz) })),
    [people, now]
  );

  // Golden window: find ref-timezone hours where ALL people are available
  const golden = useMemo(() => {
    const commonRefHours = [];
    for (let refH = 0; refH < 24; refH++) {
      const allAvail = enriched.every(p => {
        const localH = ((refH + (p.offset - refOffset)) % 24 + 24) % 24;
        return p.workHours.includes(Math.floor(localH));
      });
      if (allAvail) commonRefHours.push(refH);
    }
    if (commonRefHours.length === 0) return null;
    // Find contiguous ranges, pick the longest
    const ranges = [];
    let start = commonRefHours[0], prev = commonRefHours[0];
    for (let i = 1; i < commonRefHours.length; i++) {
      if (commonRefHours[i] === prev + 1) { prev = commonRefHours[i]; }
      else { ranges.push({ start, end: prev + 1 }); start = commonRefHours[i]; prev = commonRefHours[i]; }
    }
    ranges.push({ start, end: prev + 1 });
    ranges.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    return { start: ranges[0].start, end: ranges[0].end, allHours: commonRefHours };
  }, [enriched, refOffset]);

  const removePerson = (id) => people.length > 1 && setPeople(p => p.filter(x => x.id !== id));

  const addPerson = () => {
    if (!newName.trim()) return;
    const id = Math.max(0, ...people.map(p => p.id)) + 1;
    setPeople(prev => [...prev, {
      id, name: newName.trim(), city: newCity.trim() || COMMON_TZ.find(t => t[1] === newTz)?.[0] || newTz,
      tz: newTz, emoji: FLAG_MAP[newTz] || "🌍", workHours: hoursRange(9, 18),
    }]);
    setNewName(""); setNewCity(""); setShowAddForm(false);
  };

  const shareLink = () => {
    const url = window.location.origin + window.location.pathname + "#" + encodeConfig(people);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const mono = "'JetBrains Mono', monospace";
  const sans = "'DM Sans', -apple-system, sans-serif";

  return (
    <div style={{
      minHeight: "100vh", minHeight: "100dvh", background: "#08080a", color: "#e8e4df",
      fontFamily: sans, padding: 0, overflow: "auto",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "28px 24px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "#3a3530", marginBottom: "6px" }}>
            Timezone Sync
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 300, margin: 0, letterSpacing: "-0.3px" }}>
            Найди окно
          </h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: mono, fontSize: "32px", fontWeight: 700, color: "#f0c050", letterSpacing: "-1px", lineHeight: 1 }}>
            {now.toLocaleTimeString("en-GB", { timeZone: userTZ, hour: "2-digit", minute: "2-digit" })}
          </div>
          <div style={{ fontFamily: mono, fontSize: "11px", color: "#3a3530", marginTop: "5px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
            {now.toLocaleDateString(undefined, { timeZone: userTZ, weekday: "short", day: "numeric", month: "short" })}
            <span style={{ color: "#1a1510" }}>·</span>
            <select value={refTZ} onChange={e => setRefTZ(e.target.value)} style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "4px", padding: "1px 4px", color: "#7a7570",
              fontFamily: mono, fontSize: "11px", outline: "none", cursor: "pointer",
            }}>
              {COMMON_TZ.map(([l, v]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Share + hint */}
      <div style={{ padding: "0 24px 14px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={shareLink} style={{
          background: copied ? "rgba(80,176,128,0.12)" : "rgba(255,255,255,0.03)",
          border: copied ? "1px solid rgba(80,176,128,0.25)" : "1px solid rgba(255,255,255,0.06)",
          borderRadius: "7px", padding: "6px 12px",
          color: copied ? "#50b080" : "#5a554f",
          fontFamily: sans, fontSize: "13px", cursor: "pointer", transition: "all 0.25s",
          display: "flex", alignItems: "center", gap: "5px",
        }}>
          {copied ? "✓ Скопировано" : "🔗 Поделиться ссылкой"}
        </button>
        <div style={{ fontFamily: mono, fontSize: "11px", color: "#2a2520" }}>
          нажми на ячейку — вкл/выкл час
        </div>
      </div>

      {/* Golden Window */}
      {golden ? (
        <div style={{
          margin: "0 24px 18px", padding: "12px 16px",
          background: "linear-gradient(135deg, rgba(240,192,80,0.09) 0%, rgba(240,160,50,0.03) 100%)",
          border: "1px solid rgba(240,192,80,0.16)", borderRadius: "11px",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <div style={{
            width: "7px", height: "7px", borderRadius: "50%", background: "#f0c050",
            boxShadow: "0 0 10px rgba(240,192,80,0.5)", animation: "pulse 2s ease-in-out infinite", flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "2px", color: "#f0c050", textTransform: "uppercase", marginBottom: "2px" }}>
              Общее окно
            </div>
            <div style={{ fontSize: "20px", fontWeight: 500 }}>
              {fmtH(golden.start)} — {fmtH(golden.end)}
              <span style={{ fontSize: "13px", color: "#5a554f", marginLeft: "10px", fontWeight: 300 }}>
                по {userCity} · {golden.allHours.length}ч
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            {enriched.map(p => {
              const ls = ((golden.start + (p.offset - refOffset)) % 24 + 24) % 24;
              const le = ((golden.end + (p.offset - refOffset)) % 24 + 24) % 24;
              return <div key={p.id} style={{ fontFamily: mono, fontSize: "11px", color: "#4a4540" }}>{p.emoji} {fmtH(ls)}–{fmtH(le)}</div>;
            })}
          </div>
        </div>
      ) : (
        <div style={{
          margin: "0 24px 18px", padding: "12px 16px",
          background: "rgba(200,60,60,0.05)", border: "1px solid rgba(200,60,60,0.12)",
          borderRadius: "11px", fontSize: "14px", color: "#c86050",
        }}>
          ⚠ Нет общего окна — выдели доступные часы у каждого
        </div>
      )}

      {/* Timeline */}
      <div style={{ padding: "0 24px", overflowX: "hidden" }}>
        {/* Hours header */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(100px, 150px) 1fr", marginBottom: "1px" }}>
          <div />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)" }}>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} style={{
                fontFamily: mono, fontSize: "10px",
                color: i % 3 === 0 ? "#2a2520" : "transparent",
                textAlign: "left", paddingLeft: "1px",
              }}>{fmtH(i)}</div>
            ))}
          </div>
        </div>

        {/* Person rows */}
        {enriched.map((p, idx) => (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: "minmax(100px, 150px) 1fr",
            alignItems: "center", marginBottom: "3px",
            animation: `fadeIn 0.3s ease ${idx * 0.05}s both`,
          }}>
            {/* Info */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingRight: "12px", minWidth: 0 }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "8px",
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "17px", flexShrink: 0, position: "relative",
              }}>
                {p.emoji}
                {people.length > 1 && (
                  <button onClick={() => removePerson(p.id)} className="rm" style={{
                    position: "absolute", top: "-4px", right: "-4px",
                    width: "13px", height: "13px", borderRadius: "50%",
                    background: "#12090c", border: "1px solid rgba(200,60,60,0.25)",
                    color: "#c83c3c", fontSize: "8px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: 0, transition: "opacity 0.15s",
                  }}>×</button>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </div>
                <div style={{ fontFamily: mono, fontSize: "10px", color: "#4a4540", marginTop: "1px" }}>
                  <span style={{ color: "#7a7570" }}>{p.time.hours.toString().padStart(2, "0")}:{p.time.minutes.toString().padStart(2, "0")}</span>
                  <span style={{ color: "#1a1510" }}> · </span>
                  <span>{describeHours(p.workHours)}</span>
                </div>
              </div>
            </div>

            {/* Timeline bar — clickable cells */}
            <div
              ref={el => tlRefs.current[p.id] = el}
              style={{
                display: "grid", gridTemplateColumns: "repeat(24, 1fr)",
                height: "42px", borderRadius: "7px", overflow: "hidden",
                position: "relative",
              }}
            >
              {Array.from({ length: 24 }, (_, i) => {
                const lh = ((i + (p.offset - refOffset)) % 24 + 24) % 24;
                const localHour = Math.floor(lh);
                const isW = p.workHours.includes(localHour);
                const isG = golden && golden.allHours.includes(i);
                const isNow = Math.floor(p.time.decimal) === localHour;
                const isSleep = localHour >= 0 && localHour < 7;
                const isH = hoveredHour === i;
                let bg = "rgba(255,255,255,0.012)";
                if (isSleep && !isW) bg = "rgba(0,0,0,0.22)";
                if (isW) bg = "rgba(255,255,255,0.065)";
                if (isG && isW) bg = "rgba(240,192,80,0.15)";
                if (isH) bg = isW ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)";
                return (
                  <div
                    key={i}
                    onClick={() => toggleHour(p.id, localHour)}
                    onMouseEnter={() => setHoveredHour(i)}
                    onMouseLeave={() => setHoveredHour(null)}
                    style={{
                      background: bg,
                      borderRight: "1px solid rgba(255,255,255,0.02)",
                      position: "relative",
                      transition: "background 0.1s",
                      cursor: "pointer",
                    }}
                  >
                    {isNow && <div style={{ width: "2px", height: "100%", background: "#f0c050", borderRadius: "1px", position: "absolute", left: `${(p.time.decimal % 1) * 100}%`, top: 0, boxShadow: "0 0 6px rgba(240,192,80,0.3)", zIndex: 5, pointerEvents: "none" }} />}
                    {isG && isW && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", background: "#f0c050", opacity: 0.5, pointerEvents: "none" }} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Hover tooltip */}
        <div style={{
          display: "grid", gridTemplateColumns: "minmax(100px, 150px) 1fr",
          marginTop: "5px", height: "22px",
          opacity: hoveredHour !== null ? 1 : 0,
          transition: "opacity 0.12s ease", pointerEvents: "none",
        }}>
          <div style={{ fontFamily: mono, fontSize: "11px", color: "#4a4540" }}>{fmtH(hoveredHour ?? 0)} {userCity}</div>
          <div style={{ display: "flex", gap: "10px", fontFamily: mono, fontSize: "11px", color: "#3a3530", flexWrap: "wrap" }}>
            {enriched.map(p => {
              const lh = (((hoveredHour ?? 0) + (p.offset - refOffset)) % 24 + 24) % 24;
              const localHour = Math.floor(lh);
              const isW = p.workHours.includes(localHour);
              return <span key={p.id} style={{ color: isW ? "#7a7570" : "#1a1510" }}>{p.emoji} {fmtH(lh)} {isW ? "✓" : ""}</span>;
            })}
          </div>
        </div>
      </div>

      {/* Add person */}
      <div style={{ padding: "18px 24px" }}>
        {!showAddForm ? (
          <button onClick={() => setShowAddForm(true)} style={{
            background: "none", border: "1px dashed rgba(255,255,255,0.06)",
            borderRadius: "9px", padding: "12px 16px", color: "#2a2520",
            fontFamily: sans, fontSize: "14px", cursor: "pointer", transition: "all 0.2s", width: "100%",
          }}
            onMouseEnter={e => { e.target.style.borderColor = "rgba(240,192,80,0.2)"; e.target.style.color = "#f0c050"; }}
            onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.06)"; e.target.style.color = "#2a2520"; }}
          >+ Добавить человека</button>
        ) : (
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "11px", padding: "16px", display: "flex",
            gap: "9px", alignItems: "flex-end", flexWrap: "wrap",
          }}>
            {[
              { l: "Имя", v: newName, s: setNewName, ph: "Имя / роль", w: "120px" },
              { l: "Город", v: newCity, s: setNewCity, ph: "Город", w: "100px" },
            ].map(f => (
              <div key={f.l}>
                <label style={{ fontSize: "8px", color: "#3a3530", display: "block", marginBottom: "4px", fontFamily: mono, letterSpacing: "1.5px", textTransform: "uppercase" }}>{f.l}</label>
                <input value={f.v} onChange={e => f.s(e.target.value)} placeholder={f.ph}
                  onKeyDown={e => e.key === "Enter" && addPerson()}
                  style={{
                    background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "6px", padding: "8px 11px", color: "#e8e4df",
                    fontFamily: sans, fontSize: "12px", outline: "none", width: f.w,
                  }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: "8px", color: "#3a3530", display: "block", marginBottom: "4px", fontFamily: mono, letterSpacing: "1.5px", textTransform: "uppercase" }}>Таймзона</label>
              <select value={newTz} onChange={e => setNewTz(e.target.value)} style={{
                background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "6px", padding: "8px 11px", color: "#e8e4df",
                fontFamily: sans, fontSize: "12px", outline: "none", width: "140px",
              }}>
                {COMMON_TZ.map(([l, v]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <button onClick={addPerson} style={{
              background: "#f0c050", border: "none", borderRadius: "6px",
              padding: "8px 16px", color: "#08080a", fontFamily: sans,
              fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}>Добавить</button>
            <button onClick={() => setShowAddForm(false)} style={{
              background: "none", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "6px", padding: "8px 12px", color: "#3a3530",
              fontFamily: sans, fontSize: "12px", cursor: "pointer",
            }}>✕</button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ padding: "6px 24px 24px", display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
        {[
          { c: "rgba(255,255,255,0.065)", l: "Доступен" },
          { c: "rgba(240,192,80,0.15)", b: "rgba(240,192,80,0.3)", l: "Общее окно" },
          { c: "rgba(0,0,0,0.22)", l: "Сон" },
          { c: "#f0c050", l: "Сейчас", line: true },
        ].map(i => (
          <div key={i.l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {i.line
              ? <div style={{ width: "12px", height: "9px", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: "2px", height: "9px", background: i.c, borderRadius: "1px" }} /></div>
              : <div style={{ width: "12px", height: "9px", background: i.c, borderRadius: "2px", border: i.b ? `1px solid ${i.b}` : "1px solid rgba(255,255,255,0.03)" }} />
            }
            <span style={{ fontFamily: mono, fontSize: "11px", color: "#2a2520" }}>{i.l}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        div:hover>.rm{opacity:1!important}
        select option{background:#10101a;color:#e8e4df}
        input::placeholder{color:#1a1510}
        input:focus,select:focus{border-color:rgba(240,192,80,0.25)!important}
        ::-webkit-scrollbar{height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.04);border-radius:2px}
        @media(max-width:480px){h1{font-size:20px!important}}
        @media(max-width:360px){h1{font-size:18px!important}}
      `}</style>
    </div>
  );
}
