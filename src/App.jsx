import { useState, useEffect, useMemo, useRef } from "react";

/* ── defaults ── */
const DEFAULTS = [
  { id: 1, name: "Ты", city: "Belgrade", tz: "Europe/Belgrade", emoji: "🇷🇸", workStart: 9, workEnd: 21 },
  { id: 2, name: "Берлин", city: "Berlin", tz: "Europe/Berlin", emoji: "🇩🇪", workStart: 9, workEnd: 18 },
  { id: 3, name: "Сценарист", city: "Zürich", tz: "Europe/Zurich", emoji: "🇨🇭", workStart: 10, workEnd: 19 },
  { id: 4, name: "Агентство", city: "San Francisco", tz: "America/Los_Angeles", emoji: "🇺🇸", workStart: 9, workEnd: 18 },
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

/* ── URL hash encode/decode ── */
function encodeConfig(people) {
  const slim = people.map(p => ({
    n: p.name, c: p.city, z: p.tz, s: p.workStart, e: p.workEnd,
  }));
  return btoa(encodeURIComponent(JSON.stringify(slim)));
}

function decodeConfig(hash) {
  try {
    const json = decodeURIComponent(atob(hash));
    const arr = JSON.parse(json);
    return arr.map((p, i) => ({
      id: i + 1, name: p.n, city: p.c, tz: p.z,
      emoji: FLAG_MAP[p.z] || "🌍",
      workStart: p.s, workEnd: p.e,
    }));
  } catch { return null; }
}

function loadPeople() {
  // 1. Check URL hash
  const hash = window.location.hash.slice(1);
  if (hash) {
    const fromUrl = decodeConfig(hash);
    if (fromUrl && fromUrl.length > 0) return fromUrl;
  }
  // 2. Check localStorage
  try {
    const saved = localStorage.getItem("tz-sync-people");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  // 3. Defaults
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
  const [dragging, setDragging] = useState(null);
  const [copied, setCopied] = useState(false);
  const tlRefs = useRef({});

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  // Detect user timezone, allow manual override
  const detectedTZ = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "Europe/Belgrade";
    }
  }, []);

  const [refTZ, setRefTZ] = useState(() => {
    try {
      const saved = localStorage.getItem("tz-sync-ref");
      if (saved && COMMON_TZ.some(([, v]) => v === saved)) return saved;
    } catch {}
    // Match detected TZ to COMMON_TZ, fallback to detected
    return COMMON_TZ.find(([, v]) => v === detectedTZ)?.[1] || detectedTZ;
  });

  useEffect(() => {
    try { localStorage.setItem("tz-sync-ref", refTZ); } catch {}
  }, [refTZ]);

  const userTZ = refTZ;

  const userCity = useMemo(() => {
    const entry = COMMON_TZ.find(([, v]) => v === userTZ);
    if (entry) return entry[0];
    const parts = userTZ.split("/");
    return parts[parts.length - 1].replace(/_/g, " ");
  }, [userTZ]);

  const refOffset = getOffset(userTZ);

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem("tz-sync-people", JSON.stringify(people)); } catch {}
  }, [people]);

  // Drag handler
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const ref = tlRefs.current[dragging.pid];
      if (!ref) return;
      const rect = ref.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
      const belgH = Math.round(x * 24);
      const p = people.find(pp => pp.id === dragging.pid);
      if (!p) return;
      const localH = ((belgH + getOffset(p.tz) - getOffset(userTZ)) % 24 + 24) % 24;
      setPeople(prev => prev.map(pp => {
        if (pp.id !== dragging.pid) return pp;
        if (dragging.side === "start") return { ...pp, workStart: Math.min(localH, pp.workEnd - 1) };
        return { ...pp, workEnd: Math.max(localH, pp.workStart + 1) };
      }));
    };
    const up = () => setDragging(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [dragging, people, userTZ]);

  const enriched = useMemo(() =>
    people.map(p => ({ ...p, time: getTimeInTZ(p.tz), offset: getOffset(p.tz) })),
    [people, now]
  );

  const golden = useMemo(() => {
    let ls = -Infinity, ee = Infinity;
    enriched.forEach(p => {
      const bs = p.workStart + (refOffset - p.offset);
      const be = p.workEnd + (refOffset - p.offset);
      if (bs > ls) ls = bs;
      if (be < ee) ee = be;
    });
    return ee > ls ? { start: ls, end: ee } : null;
  }, [enriched, refOffset]);

  const removePerson = (id) => people.length > 1 && setPeople(p => p.filter(x => x.id !== id));

  const addPerson = () => {
    if (!newName.trim()) return;
    const id = Math.max(0, ...people.map(p => p.id)) + 1;
    setPeople(prev => [...prev, {
      id, name: newName.trim(), city: newCity.trim() || COMMON_TZ.find(t => t[1] === newTz)?.[0] || newTz,
      tz: newTz, emoji: FLAG_MAP[newTz] || "🌍", workStart: 9, workEnd: 18,
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

  const sd = (pid, side) => (e) => { e.preventDefault(); setDragging({ pid, side }); };

  const mono = "'JetBrains Mono', monospace";
  const sans = "'DM Sans', -apple-system, sans-serif";

  return (
    <div style={{
      minHeight: "100vh", minHeight: "100dvh", background: "#08080a", color: "#e8e4df",
      fontFamily: sans, padding: 0, overflow: "hidden",
      userSelect: dragging ? "none" : "auto",
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

      {/* Share button */}
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
          тяни края полос → рабочие часы
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
              {fmtH(Math.ceil(golden.start))} — {fmtH(Math.floor(golden.end))}
              <span style={{ fontSize: "13px", color: "#5a554f", marginLeft: "10px", fontWeight: 300 }}>
                по {userCity} · {Math.max(0, Math.floor(golden.end) - Math.ceil(golden.start))}ч
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            {enriched.map(p => {
              const ls = ((Math.ceil(golden.start) + (p.offset - refOffset)) % 24 + 24) % 24;
              const le = ((Math.floor(golden.end) + (p.offset - refOffset)) % 24 + 24) % 24;
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
          ⚠ Нет общего окна — подвинь чьи-нибудь рабочие часы
        </div>
      )}

      {/* Timeline */}
      <div style={{ padding: "0 24px", overflowX: "auto" }}>
        {/* Hours header */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(130px, 170px) 1fr", marginBottom: "1px" }}>
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
        {enriched.map((p, idx) => {
          const wsBelg = ((p.workStart + (refOffset - p.offset)) % 24 + 24) % 24;
          const weBelg = ((p.workEnd + (refOffset - p.offset)) % 24 + 24) % 24;
          return (
            <div key={p.id} style={{
              display: "grid", gridTemplateColumns: "minmax(130px, 170px) 1fr",
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
                  <div style={{ fontFamily: mono, fontSize: "11px", color: "#4a4540", display: "flex", gap: "5px", alignItems: "center" }}>
                    <span style={{ color: "#7a7570" }}>{p.time.hours.toString().padStart(2, "0")}:{p.time.minutes.toString().padStart(2, "0")}</span>
                    <span style={{ color: "#1a1510" }}>·</span>
                    <span>{fmtH(p.workStart)}–{fmtH(p.workEnd)}</span>
                  </div>
                </div>
              </div>

              {/* Timeline bar */}
              <div
                ref={el => tlRefs.current[p.id] = el}
                style={{
                  display: "grid", gridTemplateColumns: "repeat(24, 1fr)",
                  height: "42px", borderRadius: "7px", overflow: "hidden",
                  position: "relative", cursor: dragging ? "ew-resize" : "crosshair",
                }}
                onMouseMove={(e) => {
                  if (dragging) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  setHoveredHour(Math.floor(((e.clientX - r.left) / r.width) * 24));
                }}
                onMouseLeave={() => !dragging && setHoveredHour(null)}
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const lh = ((i + (p.offset - refOffset)) % 24 + 24) % 24;
                  const isW = lh >= p.workStart && lh < p.workEnd;
                  const isG = golden && i >= Math.ceil(golden.start) && i < Math.floor(golden.end);
                  const isNow = Math.floor(p.time.decimal) === Math.floor(lh);
                  const isSleep = lh >= 0 && lh < 7;
                  const isH = hoveredHour === i && !dragging;
                  let bg = "rgba(255,255,255,0.012)";
                  if (isSleep) bg = "rgba(0,0,0,0.22)";
                  if (isW) bg = "rgba(255,255,255,0.055)";
                  if (isG && isW) bg = "rgba(240,192,80,0.12)";
                  if (isH) bg = isW ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.03)";
                  return (
                    <div key={i} style={{ background: bg, borderRight: "1px solid rgba(255,255,255,0.015)", position: "relative", transition: "background 0.1s" }}>
                      {isNow && <div style={{ width: "2px", height: "100%", background: "#f0c050", borderRadius: "1px", position: "absolute", left: `${(p.time.decimal % 1) * 100}%`, top: 0, boxShadow: "0 0 6px rgba(240,192,80,0.3)", zIndex: 5 }} />}
                      {isG && isW && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", background: "#f0c050", opacity: 0.4 }} />}
                    </div>
                  );
                })}

                {/* Drag overlay */}
                {(() => {
                  const sp = (wsBelg / 24) * 100;
                  const raw = weBelg > wsBelg ? weBelg - wsBelg : 24 - wsBelg + weBelg;
                  const wp = (raw / 24) * 100;
                  const active = dragging?.pid === p.id;
                  return (
                    <div style={{
                      position: "absolute", left: `${sp}%`, width: `${wp}%`,
                      top: 0, bottom: 0, pointerEvents: "none",
                      borderLeft: `1.5px solid rgba(240,192,80,${active ? 0.6 : 0.25})`,
                      borderRight: `1.5px solid rgba(240,192,80,${active ? 0.6 : 0.25})`,
                      zIndex: 8, transition: "border-color 0.15s",
                    }}>
                      {["start", "end"].map(side => (
                        <div key={side} style={{
                          position: "absolute", [side === "start" ? "left" : "right"]: "-7px",
                          top: 0, bottom: 0, width: "14px", cursor: "ew-resize",
                          pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 12,
                        }} onMouseDown={sd(p.id, side)} onTouchStart={sd(p.id, side)}>
                          <div style={{
                            width: active && dragging?.side === side ? "4px" : "3px",
                            height: active && dragging?.side === side ? "20px" : "14px",
                            borderRadius: "2px",
                            background: active && dragging?.side === side ? "#f0c050" : "rgba(240,192,80,0.45)",
                            transition: "all 0.15s",
                          }} />
                        </div>
                      ))}
                      {active && <>
                        <div style={{ position: "absolute", left: "-2px", top: "-16px", fontFamily: mono, fontSize: "8px", color: "#f0c050", background: "rgba(8,8,10,0.9)", padding: "1px 4px", borderRadius: "3px", whiteSpace: "nowrap", zIndex: 20 }}>{fmtH(p.workStart)}</div>
                        <div style={{ position: "absolute", right: "-2px", top: "-16px", fontFamily: mono, fontSize: "8px", color: "#f0c050", background: "rgba(8,8,10,0.9)", padding: "1px 4px", borderRadius: "3px", whiteSpace: "nowrap", zIndex: 20 }}>{fmtH(p.workEnd)}</div>
                      </>}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}

        {/* Hover tooltip */}
        <div style={{
          display: "grid", gridTemplateColumns: "minmax(130px, 170px) 1fr",
          marginTop: "5px",
          height: "22px",
          opacity: hoveredHour !== null && !dragging ? 1 : 0,
          transition: "opacity 0.12s ease",
          pointerEvents: "none",
        }}>
          <div style={{ fontFamily: mono, fontSize: "11px", color: "#4a4540" }}>{fmtH(hoveredHour ?? 0)} {userCity}</div>
          <div style={{ display: "flex", gap: "10px", fontFamily: mono, fontSize: "11px", color: "#3a3530", flexWrap: "wrap" }}>
            {enriched.map(p => {
              const lh = (((hoveredHour ?? 0) + (p.offset - refOffset)) % 24 + 24) % 24;
              const isW = lh >= p.workStart && lh < p.workEnd;
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
          { c: "rgba(255,255,255,0.055)", l: "Рабочие часы" },
          { c: "rgba(240,192,80,0.12)", b: "rgba(240,192,80,0.3)", l: "Общее окно" },
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
        @media(max-width:480px){
          h1{font-size:18px!important}
        }
      `}</style>
    </div>
  );
}
