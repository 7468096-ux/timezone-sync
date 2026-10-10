import { useState, useEffect, useMemo, useRef } from "react";
import {
  getTimeInTZ, getOffset, fmtH, fmtTime, fmtOffset, localHourAt, dayShift, fmtDayShift,
  describeHours, findCommonWindow, hoursRange, mod24,
} from "./lib/time.js";
import { MAX_PEOPLE, flagFor, cityFor, allTimeZones, sortedCommonTZ, encodeConfig } from "./lib/config.js";
import {
  EMBED, consumeMigration, loadInitial, savePeople, takeHash, parseCode, sameConfig, rememberBackup, loadRefTZ, saveRefTZ, nextId,
} from "./lib/storage.js";

consumeMigration();
const INITIAL = loadInitial();

const mono = "'JetBrains Mono', monospace";
const sans = "'DM Sans', -apple-system, sans-serif";

/* ── timezone select: common zones by offset + every IANA zone the browser knows ── */
function TzSelect({ value, onChange, now, style }) {
  const common = useMemo(() => sortedCommonTZ(now), [now.getUTCHours()]); // offsets only change on hour boundaries
  const others = useMemo(() => {
    const known = new Set(common.map(c => c.tz));
    return allTimeZones().filter(tz => !known.has(tz));
  }, [common]);
  const inList = common.some(c => c.tz === value) || others.includes(value);
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={style}>
      {!inList && <option value={value}>{cityFor(value)} ({fmtOffset(getOffset(value, now))})</option>}
      {common.map(c => <option key={c.tz} value={c.tz}>{c.label} ({fmtOffset(c.offset)})</option>)}
      {others.length > 0 && (
        <optgroup label="Все зоны">
          {others.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
        </optgroup>
      )}
    </select>
  );
}

/* ── add / edit form ── */
const labelStyle = { fontSize: "9px", color: "#6a655f", display: "block", marginBottom: "4px", fontFamily: mono, letterSpacing: "1.5px", textTransform: "uppercase" };
const fieldStyle = {
  background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "6px", padding: "8px 11px", color: "#e8e4df",
  fontFamily: sans, fontSize: "13px", outline: "none",
};

function PersonForm({ initial, submitLabel, onSubmit, onCancel, now }) {
  const [name, setName] = useState(initial.name);
  // An auto-derived city is left empty so it follows the timezone if that changes
  const [city, setCity] = useState(initial.city === cityFor(initial.tz) ? "" : initial.city);
  const [tz, setTz] = useState(initial.tz);

  const submit = () => {
    const c = city.trim() || cityFor(tz);
    onSubmit({ name: name.trim() || c, city: c, tz, emoji: flagFor(tz) });
  };
  const onKey = (e) => {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div onKeyDown={onKey} style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "11px", padding: "16px", display: "flex",
      gap: "9px", alignItems: "flex-end", flexWrap: "wrap",
    }}>
      <div>
        <label style={labelStyle}>Имя</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Имя / роль" maxLength={40} style={{ ...fieldStyle, width: "130px" }} />
      </div>
      <div>
        <label style={labelStyle}>Город</label>
        <input value={city} onChange={e => setCity(e.target.value)} placeholder={cityFor(tz)} maxLength={40} style={{ ...fieldStyle, width: "110px" }} />
      </div>
      <div>
        <label style={labelStyle}>Таймзона</label>
        <TzSelect value={tz} onChange={setTz} now={now} style={{ ...fieldStyle, width: "190px" }} />
      </div>
      <button onClick={submit} style={{
        background: "#f0c050", border: "none", borderRadius: "6px",
        padding: "9px 16px", color: "#08080a", fontFamily: sans,
        fontSize: "13px", fontWeight: 600, cursor: "pointer",
      }}>{submitLabel}</button>
      <button onClick={onCancel} title="Отмена (Esc)" style={{
        background: "none", border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: "6px", padding: "9px 12px", color: "#6a655f",
        fontFamily: sans, fontSize: "13px", cursor: "pointer",
      }}>✕</button>
    </div>
  );
}

function fmtDuration(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h}ч${m ? ` ${m}м` : ""}` : `${m}м`;
}

/* ── component ── */
export default function App() {
  const [now, setNow] = useState(() => new Date());
  const [people, setPeople] = useState(INITIAL.people);
  const [notice, setNotice] = useState(INITIAL.notice);
  const [hoveredHour, setHoveredHour] = useState(null);
  const [form, setForm] = useState(null); // null | { mode: "add" } | { mode: "edit", id }
  const [copied, setCopied] = useState(false);
  const paint = useRef(null);           // { pid, value } while dragging with the mouse
  const lastPointer = useRef("mouse");
  const peopleRef = useRef(people);
  peopleRef.current = people;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    savePeople(people);
  }, [people]);

  const applyLink = (fromLink) => {
    if (!fromLink || fromLink.sync) return;
    if (fromLink === "invalid") { setNotice({ kind: "badlink" }); return; }
    const current = peopleRef.current;
    const backup = sameConfig(current, fromLink) ? null : current;
    if (backup) rememberBackup(backup);
    setPeople(fromLink);
    setNotice({ kind: "link", backup });
  };

  // A shared link pasted into an already open tab only changes the hash
  useEffect(() => {
    const onHash = () => applyLink(takeHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const stop = () => { paint.current = null; };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => { window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
  }, []);

  useEffect(() => {
    if (notice?.kind !== "removed") return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const [refTZ, setRefTZ] = useState(loadRefTZ);
  // Saved only on an explicit choice, so auto-detection keeps working after travel
  const chooseRefTZ = (tz) => {
    setRefTZ(tz);
    saveRefTZ(tz);
  };

  const refCity = cityFor(refTZ);
  const refOffset = getOffset(refTZ, now);
  const refNow = getTimeInTZ(refTZ, now).decimal;
  const nowCol = Math.floor(refNow);

  const enriched = useMemo(() => people.map(p => {
    const offset = getOffset(p.tz, now);
    return { ...p, offset, diff: offset - refOffset, time: getTimeInTZ(p.tz, now), hourSet: new Set(p.workHours) };
  }), [people, now, refOffset]);

  const golden = useMemo(() => findCommonWindow(enriched, refOffset), [enriched, refOffset]);

  // "now" / "in N" for the common window
  const goldenStatus = useMemo(() => {
    if (!golden) return null;
    if (golden.allHours.includes(nowCol)) return { live: true };
    const mins = Math.min(...golden.allHours.map(h => mod24(h - refNow) * 60));
    return { live: false, in: fmtDuration(mins) };
  }, [golden, nowCol, refNow]);

  const setHour = (pid, hour, value) => setPeople(prev => prev.map(p => {
    if (p.id !== pid || p.workHours.includes(hour) === value) return p;
    const workHours = value ? [...p.workHours, hour].sort((a, b) => a - b) : p.workHours.filter(h => h !== hour);
    // v1 edits whole hours only: drop the half-hour schedule so it is rebuilt from workHours
    return { ...p, workHours, slots: undefined };
  }));

  const removePerson = (id) => {
    const index = people.findIndex(p => p.id === id);
    if (index < 0 || people.length <= 1) return;
    setPeople(prev => prev.filter(p => p.id !== id));
    setNotice({ kind: "removed", person: people[index], index });
    if (form?.id === id) setForm(null);
  };

  const undoRemove = () => {
    const { person, index } = notice;
    setPeople(prev => {
      const arr = [...prev];
      arr.splice(Math.min(index, arr.length), 0, { ...person, id: nextId(prev) });
      return arr;
    });
    setNotice(null);
  };

  const restoreBackup = () => {
    setPeople(notice.backup);
    setNotice(null);
  };

  const submitForm = (data) => {
    if (form.mode === "add") {
      setPeople(prev => [...prev, { id: nextId(prev), ...data, workHours: hoursRange(9, 18) }]);
    } else {
      setPeople(prev => prev.map(p => p.id === form.id ? { ...p, ...data } : p));
    }
    setForm(null);
  };

  const shareLink = async () => {
    const text = EMBED
      ? encodeConfig(people)
      : window.location.origin + window.location.pathname + "#" + encodeConfig(people);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard API (plain http, old WebView, denied permission): show it to copy by hand
      setNotice({ kind: "share", text });
    }
  };

  const [importText, setImportText] = useState(null); // null = field hidden
  const importCode = () => {
    const raw = importText.trim();
    if (!raw) return;
    applyLink(parseCode(raw));
    setImportText(null);
  };

  const editing = form?.mode === "edit" ? people.find(p => p.id === form.id) : null;

  const noticeBox = {
    margin: "0 24px 14px", padding: "9px 14px", borderRadius: "9px",
    display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
    fontSize: "13px", color: "#a8a49f",
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
  };
  const linkBtn = {
    background: "none", border: "1px solid rgba(240,192,80,0.3)", borderRadius: "6px",
    padding: "4px 10px", color: "#f0c050", fontFamily: sans, fontSize: "12px", cursor: "pointer",
  };

  return (
    <div style={{
      minHeight: "100dvh", background: "#08080a", color: "#e8e4df",
      fontFamily: sans, padding: 0, overflow: "auto",
    }}>
      {/* Header */}
      <div style={{ padding: "28px 24px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "#6a655f", marginBottom: "6px" }}>
            Timezone Sync
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 300, margin: 0, letterSpacing: "-0.3px" }}>
            Найди окно
          </h1>
        </div>
        <div style={{ textAlign: "right", minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: "32px", fontWeight: 700, color: "#f0c050", letterSpacing: "-1px", lineHeight: 1 }}>
            {now.toLocaleTimeString("en-GB", { timeZone: refTZ, hour: "2-digit", minute: "2-digit" })}
          </div>
          <div style={{ fontFamily: mono, fontSize: "11px", color: "#6a655f", marginTop: "5px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", flexWrap: "wrap" }}>
            {now.toLocaleDateString("ru-RU", { timeZone: refTZ, weekday: "short", day: "numeric", month: "short" })}
            <span style={{ color: "#3a3530" }}>·</span>
            <TzSelect value={refTZ} onChange={chooseRefTZ} now={now} style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px", padding: "1px 4px", color: "#9a958f", maxWidth: "170px",
              fontFamily: mono, fontSize: "11px", outline: "none", cursor: "pointer",
            }} />
          </div>
        </div>
      </div>

      {/* Notices */}
      {notice?.kind === "link" && (
        <div style={noticeBox}>
          <span style={{ flex: 1, minWidth: "180px" }}>🔗 Загружена конфигурация из {EMBED ? "кода" : "ссылки"} — она сохранена как твоя.</span>
          {notice.backup && <button onClick={restoreBackup} style={linkBtn}>Вернуть мою</button>}
          <button onClick={() => setNotice(null)} style={{ ...linkBtn, borderColor: "rgba(255,255,255,0.1)", color: "#8a857f" }}>OK</button>
        </div>
      )}
      {notice?.kind === "badlink" && (
        <div style={{ ...noticeBox, color: "#c86050", borderColor: "rgba(200,60,60,0.2)" }}>
          <span style={{ flex: 1 }}>⚠ {EMBED ? "Код" : "Ссылка"} повреждён{EMBED ? "" : "а"} или обрезан{EMBED ? "" : "а"} — показана твоя сохранённая конфигурация.</span>
          <button onClick={() => setNotice(null)} style={{ ...linkBtn, borderColor: "rgba(255,255,255,0.1)", color: "#8a857f" }}>OK</button>
        </div>
      )}
      {notice?.kind === "share" && (
        <div style={noticeBox}>
          <span>Скопируй {EMBED ? "код" : "ссылку"}:</span>
          <input id="share-text" readOnly autoFocus value={notice.text} onFocus={e => e.target.select()}
            style={{ ...fieldStyle, flex: 1, minWidth: "160px", fontFamily: mono, fontSize: "11px" }} />
          <button onClick={() => setNotice(null)} style={{ ...linkBtn, borderColor: "rgba(255,255,255,0.1)", color: "#8a857f" }}>Готово</button>
        </div>
      )}
      {notice?.kind === "removed" && (
        <div style={noticeBox}>
          <span style={{ flex: 1 }}>Удалён: {notice.person.emoji} {notice.person.name}</span>
          <button onClick={undoRemove} style={linkBtn}>Отменить</button>
        </div>
      )}

      {/* Share + hint */}
      <div style={{ padding: "0 24px 14px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={shareLink} style={{
          background: copied ? "rgba(80,176,128,0.12)" : "rgba(255,255,255,0.03)",
          border: copied ? "1px solid rgba(80,176,128,0.25)" : "1px solid rgba(255,255,255,0.08)",
          borderRadius: "7px", padding: "6px 12px",
          color: copied ? "#50b080" : "#9a958f",
          fontFamily: sans, fontSize: "13px", cursor: "pointer", transition: "all 0.25s",
          display: "flex", alignItems: "center", gap: "5px",
        }}>
          {copied ? "✓ Скопировано" : EMBED ? "🔗 Скопировать код" : "🔗 Поделиться ссылкой"}
        </button>
        {EMBED && importText === null && (
          <button onClick={() => setImportText("")} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "7px", padding: "6px 12px", color: "#9a958f",
            fontFamily: sans, fontSize: "13px", cursor: "pointer",
          }}>📥 Вставить код</button>
        )}
        {EMBED && importText !== null && (
          <div style={{ display: "flex", gap: "6px", flex: "1 1 260px", minWidth: 0 }}>
            <input id="import-code" autoFocus value={importText} onChange={e => setImportText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") importCode(); if (e.key === "Escape") setImportText(null); }}
              placeholder="код или ссылка" style={{ ...fieldStyle, flex: 1, minWidth: 0, padding: "6px 10px", fontFamily: mono, fontSize: "11px" }} />
            <button onClick={importCode} style={linkBtn}>Загрузить</button>
            <button onClick={() => setImportText(null)} style={{ ...linkBtn, borderColor: "rgba(255,255,255,0.1)", color: "#8a857f" }}>✕</button>
          </div>
        )}
        <div style={{ fontFamily: mono, fontSize: "11px", color: "#5a554f" }}>
          ячейка — вкл/выкл час · мышью можно протянуть · имя — изменить
        </div>
      </div>

      {/* Golden Window */}
      {golden ? (
        <div style={{
          margin: "0 24px 18px", padding: "12px 16px",
          background: "linear-gradient(135deg, rgba(240,192,80,0.09) 0%, rgba(240,160,50,0.03) 100%)",
          border: "1px solid rgba(240,192,80,0.16)", borderRadius: "11px",
          display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
        }}>
          <div style={{
            width: "7px", height: "7px", borderRadius: "50%", background: "#f0c050",
            boxShadow: "0 0 10px rgba(240,192,80,0.5)", animation: "pulse 2s ease-in-out infinite", flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ fontFamily: mono, fontSize: "11px", letterSpacing: "2px", color: "#f0c050", textTransform: "uppercase", marginBottom: "2px" }}>
              Общее окно
              <span style={{ letterSpacing: 0, textTransform: "none", color: goldenStatus.live ? "#50b080" : "#8a857f", marginLeft: "8px" }}>
                {goldenStatus.live ? "● идёт сейчас" : `через ${goldenStatus.in}`}
              </span>
            </div>
            <div style={{ fontSize: "20px", fontWeight: 500 }}>
              {fmtH(golden.best.start)} — {fmtH(golden.best.end)}
              <span style={{ fontSize: "13px", color: "#8a857f", marginLeft: "10px", fontWeight: 300 }}>
                по {refCity} · {golden.best.end - golden.best.start}ч
              </span>
            </div>
            {golden.ranges.length > 1 && (
              <div style={{ fontFamily: mono, fontSize: "11px", color: "#8a857f", marginTop: "3px" }}>
                ещё: {golden.ranges.filter(r => r !== golden.best).map(r => `${fmtH(r.start)}–${fmtH(r.end)}`).join(", ")}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            {enriched.map(p => (
              <div key={p.id} title={p.name} style={{ fontFamily: mono, fontSize: "11px", color: "#8a857f" }}>
                {p.emoji} {fmtTime(golden.best.start + p.diff)}–{fmtTime(golden.best.end + p.diff)}
                <span style={{ color: "#f0c050" }}>{fmtDayShift(dayShift(golden.best.start, p.diff))}</span>
              </div>
            ))}
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
      <div style={{ padding: "0 24px", overflowX: "hidden" }} onMouseLeave={() => setHoveredHour(null)}>
        {/* Hours header */}
        <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", marginBottom: "1px" }}>
          <div />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} style={{
                fontFamily: mono, fontSize: "10px",
                color: i % 3 === 0 ? (i === nowCol ? "#f0c050" : "#5a554f") : "transparent",
                textAlign: "left", paddingLeft: "1px", whiteSpace: "nowrap", overflow: "visible",
              }}>{String(i).padStart(2, "0")}<span className="mm">:00</span></div>
            ))}
          </div>
        </div>

        {/* Person rows */}
        {enriched.map((p, idx) => (
          <div key={p.id} style={{
            display: "grid", gridTemplateColumns: "130px 1fr",
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
              }} className="avatar">
                {p.emoji}
                {people.length > 1 && (
                  <button onClick={() => removePerson(p.id)} className="rm" aria-label={`Удалить ${p.name}`} title="Удалить" style={{
                    position: "absolute", top: "-6px", right: "-6px",
                    width: "18px", height: "18px", borderRadius: "50%", padding: 0,
                    background: "#12090c", border: "1px solid rgba(200,60,60,0.35)",
                    color: "#c83c3c", fontSize: "11px", lineHeight: 1, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: 0, transition: "opacity 0.15s",
                  }}>×</button>
                )}
              </div>
              <button
                onClick={() => setForm({ mode: "edit", id: p.id })}
                title={`${p.city} · ${fmtOffset(p.offset)}\n${describeHours(p.workHours)}\nНажми, чтобы изменить`}
                style={{ minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", color: "inherit", cursor: "pointer", fontFamily: sans }}
              >
                <span style={{ display: "block", fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </span>
                <span style={{ display: "block", fontFamily: mono, fontSize: "10px", color: "#6a655f", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ color: "#9a958f" }}>{fmtTime(p.time.decimal)}</span>
                  <span style={{ color: "#3a3530" }}> · </span>
                  <span>{p.workHours.length}ч</span>
                </span>
              </button>
            </div>

            {/* Timeline bar — click to toggle, mouse-drag to paint */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(24, minmax(0, 1fr))",
              height: "42px", borderRadius: "7px", overflow: "hidden",
              position: "relative", userSelect: "none",
            }}>
              {Array.from({ length: 24 }, (_, i) => {
                const localHour = localHourAt(i, p.diff);
                const isW = p.hourSet.has(localHour);
                const isG = golden && golden.allHours.includes(i);
                const isSleep = localHour < 7;
                const isH = hoveredHour === i;
                let bg = "rgba(255,255,255,0.012)";
                if (isSleep && !isW) bg = "rgba(0,0,0,0.3)";
                if (isW) bg = "rgba(255,255,255,0.075)";
                if (isG && isW) bg = "rgba(240,192,80,0.15)";
                if (isH) bg = isW ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.045)";
                return (
                  <div
                    key={i}
                    title={`${p.name}: ${fmtTime(i + p.diff)} — ${isW ? "доступен" : "занят"}`}
                    onPointerDown={e => {
                      lastPointer.current = e.pointerType;
                      if (e.pointerType !== "mouse" || e.button !== 0) return;
                      e.preventDefault();
                      paint.current = { pid: p.id, value: !isW };
                      setHour(p.id, localHour, !isW);
                    }}
                    onPointerEnter={e => {
                      setHoveredHour(i);
                      // buttons check: a release outside the window/iframe never sends pointerup
                      if (paint.current && !(e.buttons & 1)) paint.current = null;
                      if (paint.current?.pid === p.id) setHour(p.id, localHour, paint.current.value);
                    }}
                    // Touch: toggle on click (a scroll gesture doesn't produce one)
                    onClick={() => { if (lastPointer.current !== "mouse") setHour(p.id, localHour, !isW); }}
                    style={{
                      background: bg,
                      borderRight: "1px solid rgba(255,255,255,0.025)",
                      position: "relative",
                      transition: "background 0.1s",
                      cursor: "pointer",
                    }}
                  >
                    {i === nowCol && <div style={{ width: "2px", height: "100%", background: "#f0c050", borderRadius: "1px", position: "absolute", left: `${(refNow % 1) * 100}%`, top: 0, boxShadow: "0 0 6px rgba(240,192,80,0.3)", zIndex: 5, pointerEvents: "none" }} />}
                    {isG && isW && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", background: "#f0c050", opacity: 0.5, pointerEvents: "none" }} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Hover tooltip */}
        <div style={{
          display: "grid", gridTemplateColumns: "130px 1fr",
          marginTop: "5px", minHeight: "22px",
          opacity: hoveredHour !== null ? 1 : 0,
          transition: "opacity 0.12s ease", pointerEvents: "none",
        }}>
          <div style={{ fontFamily: mono, fontSize: "11px", color: "#8a857f" }}>{fmtH(hoveredHour ?? 0)} {refCity}</div>
          <div style={{ display: "flex", gap: "10px", fontFamily: mono, fontSize: "11px", flexWrap: "wrap" }}>
            {enriched.map(p => {
              const h = hoveredHour ?? 0;
              const isW = p.hourSet.has(localHourAt(h, p.diff));
              return (
                <span key={p.id} style={{ color: isW ? "#b8b4af" : "#4a4540" }}>
                  {p.emoji} {fmtTime(h + p.diff)}{fmtDayShift(dayShift(h, p.diff))} {isW ? "✓" : ""}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add / edit person */}
      <div style={{ padding: "18px 24px" }}>
        {form ? (
          <PersonForm
            key={form.mode === "edit" ? `e${form.id}` : "add"}
            now={now}
            initial={editing || { name: "", city: cityFor(refTZ), tz: refTZ }}
            submitLabel={editing ? "Сохранить" : "Добавить"}
            onSubmit={submitForm}
            onCancel={() => setForm(null)}
          />
        ) : people.length < MAX_PEOPLE && (
          <button onClick={() => setForm({ mode: "add" })} className="add" style={{
            background: "none", border: "1px dashed rgba(255,255,255,0.1)",
            borderRadius: "9px", padding: "12px 16px", color: "#6a655f",
            fontFamily: sans, fontSize: "14px", cursor: "pointer", transition: "all 0.2s", width: "100%",
          }}>+ Добавить человека</button>
        )}
      </div>

      {/* Legend */}
      <div style={{ padding: "6px 24px 24px", display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
        {[
          { c: "rgba(255,255,255,0.075)", l: "Доступен" },
          { c: "rgba(240,192,80,0.15)", b: "rgba(240,192,80,0.3)", l: "Общее окно" },
          { c: "rgba(0,0,0,0.3)", b: "rgba(255,255,255,0.08)", l: "Сон (00–07)" },
          { c: "#f0c050", l: "Сейчас", line: true },
        ].map(i => (
          <div key={i.l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {i.line
              ? <div style={{ width: "12px", height: "9px", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: "2px", height: "9px", background: i.c, borderRadius: "1px" }} /></div>
              : <div style={{ width: "12px", height: "9px", background: i.c, borderRadius: "2px", border: `1px solid ${i.b || "rgba(255,255,255,0.05)"}` }} />
            }
            <span style={{ fontFamily: mono, fontSize: "11px", color: "#6a655f" }}>{i.l}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        .avatar:hover>.rm,.rm:focus-visible{opacity:1!important}
        @media(hover:none){.rm{opacity:.75!important}}
        .add:hover{border-color:rgba(240,192,80,0.3)!important;color:#f0c050!important}
        select option,select optgroup{background:#10101a;color:#e8e4df}
        input::placeholder{color:#4a4540}
        input:focus,select:focus{border-color:rgba(240,192,80,0.35)!important}
        ::-webkit-scrollbar{height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.04);border-radius:2px}
        @media(max-width:600px){.mm{display:none}}
        @media(max-width:480px){h1{font-size:20px!important}}
        @media(max-width:360px){h1{font-size:18px!important}}
      `}</style>
    </div>
  );
}
