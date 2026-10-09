import { useState, useEffect, useMemo, useRef } from "react";
import {
  getTimeInTZ, getOffset, fmtTime, fmtOffset, localHourAt, describeHours, findCommonWindow,
  findBestPartial, freeForSlot, coversRefHour, hoursRange, mod24,
} from "../lib/time.js";
import { MAX_PEOPLE, flagFor, cityFor, allTimeZones, sortedCommonTZ, encodeConfig } from "../lib/config.js";
import {
  EMBED, loadInitial, savePeople, takeHash, parseCode, sameConfig, rememberBackup, loadRefTZ, saveRefTZ, nextId,
} from "../lib/storage.js";
import "./styles.css";

const INITIAL = loadInitial();
const MAX_LEN = 12;

const pad = (n) => String(n).padStart(2, "0");
const fmtHour = (h) => `${pad(mod24(h))}:00`;
const fmtLen = (n) => `${n} ч`;
function fmtDuration(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} ч${m ? ` ${m} мин` : ""}` : `${m} мин`;
}
const weekday = (date, tz) => date.toLocaleDateString("ru-RU", { timeZone: tz, weekday: "short" });

/* ── timezone select ── */
function TzSelect({ id, value, onChange, now, className = "select" }) {
  const common = useMemo(() => sortedCommonTZ(now), [now.getUTCHours()]); // offsets only change on hour boundaries
  const others = useMemo(() => {
    const known = new Set(common.map(c => c.tz));
    return allTimeZones().filter(tz => !known.has(tz));
  }, [common]);
  const inList = common.some(c => c.tz === value) || others.includes(value);
  return (
    <select id={id} className={className} value={value} onChange={e => onChange(e.target.value)}>
      {!inList && <option value={value}>{cityFor(value)} ({fmtOffset(getOffset(value, now))})</option>}
      <optgroup label="Популярные">
        {common.map(c => <option key={c.tz} value={c.tz}>{c.label} ({fmtOffset(c.offset)})</option>)}
      </optgroup>
      {others.length > 0 && (
        <optgroup label="Все зоны">
          {others.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
        </optgroup>
      )}
    </select>
  );
}

/* ── person editor (sheet) ── */
const PRESETS = [
  ["9–18", hoursRange(9, 18)],
  ["10–19", hoursRange(10, 19)],
  ["8–17", hoursRange(8, 17)],
  ["Весь день", hoursRange(0, 24)],
  ["Очистить", []],
];

function Editor({ initial, isNew, canDelete, now, onSave, onDelete, onClose }) {
  const [name, setName] = useState(initial.name);
  const [city, setCity] = useState(initial.city === cityFor(initial.tz) ? "" : initial.city);
  const [tz, setTz] = useState(initial.tz);
  const [hours, setHours] = useState(() => new Set(initial.workHours));
  const [from, setFrom] = useState(9);
  const [to, setTo] = useState(18);
  const paint = useRef(null);
  const lastType = useRef("mouse");

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const stop = () => { paint.current = null; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerup", stop);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerup", stop); };
  }, [onClose]);

  const setHour = (h, on) => setHours(prev => {
    if (prev.has(h) === on) return prev;
    const next = new Set(prev);
    on ? next.add(h) : next.delete(h);
    return next;
  });

  const applyRange = () => {
    const list = [];
    for (let h = from; h !== to; h = (h + 1) % 24) list.push(h); // wraps for night shifts
    setHours(new Set(list.length ? list : hoursRange(0, 24)));
  };

  const save = () => {
    const c = city.trim() || cityFor(tz);
    onSave({ name: name.trim() || c, city: c, tz, emoji: flagFor(tz), workHours: [...hours].sort((a, b) => a - b) });
  };

  const sorted = [...hours].sort((a, b) => a - b);
  const localNow = getTimeInTZ(tz, now);

  return (
    <div className="backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="ed-title"
        onKeyDown={e => { if (e.key === "Enter" && e.target.tagName === "INPUT") save(); }}>
        <h2 id="ed-title">{isNew ? "Новый участник" : "Участник"}</h2>
        <div className="form-row">
          <label className="label">Имя или роль
            <input id="ed-name" className="field" autoFocus value={name} maxLength={40} placeholder="Например, Аня или «Дизайн»" onChange={e => setName(e.target.value)} />
          </label>
          <label className="label">Город
            <input id="ed-city" className="field" value={city} maxLength={40} placeholder={cityFor(tz)} onChange={e => setCity(e.target.value)} />
          </label>
          <label className="label full"><span>Часовой пояс · сейчас там <span className="num">{fmtTime(localNow.decimal)}</span></span>
            <TzSelect id="ed-tz" className="field" value={tz} onChange={setTz} now={now} />
          </label>
        </div>

        <div className="label">Рабочие часы (по местному времени)
          <div className="presets">
            {PRESETS.map(([label, list]) => (
              <button key={label} type="button" className="chip" onClick={() => setHours(new Set(list))}>{label}</button>
            ))}
          </div>
          <div className="range-set">
            с
            <select id="ed-from" className="select" value={from} onChange={e => setFrom(+e.target.value)}>
              {hoursRange(0, 24).map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
            до
            <select id="ed-to" className="select" value={to} onChange={e => setTo(+e.target.value)}>
              {hoursRange(0, 24).map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
            <button type="button" className="btn small" onClick={applyRange}>Задать</button>
          </div>
          <div className="hours" aria-label="Часы: нажми, чтобы включить или выключить">
            {hoursRange(0, 24).map(h => (
              <button key={h} type="button" className={`hour${hours.has(h) ? " on" : ""}`} aria-pressed={hours.has(h)}
                onPointerDown={e => {
                  lastType.current = e.pointerType;
                  if (e.pointerType === "mouse" && e.button === 0) { e.preventDefault(); paint.current = !hours.has(h); setHour(h, paint.current); }
                }}
                onPointerEnter={e => { if (paint.current !== null && e.buttons & 1) setHour(h, paint.current); }}
                // keyboard (detail 0) and touch toggle on click; mouse already toggled on pointerdown
                onClick={e => { if (e.detail === 0 || lastType.current !== "mouse") setHour(h, !hours.has(h)); }}
              >{pad(h)}</button>
            ))}
          </div>
          <div className="hours-sum">{sorted.length ? `${describeHours(sorted)} · ${sorted.length} ч` : "Нет свободных часов"}</div>
        </div>

        <div className="sheet-actions">
          {!isNew && canDelete && <button type="button" className="btn ghost danger" onClick={onDelete}>Удалить</button>}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Отмена</button>
          <button type="button" className="btn primary" onClick={save}>{isNew ? "Добавить" : "Сохранить"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── app ── */
export default function App() {
  const [now, setNow] = useState(() => new Date());
  const [people, setPeople] = useState(INITIAL.people);
  const [notice, setNotice] = useState(INITIAL.notice);
  const [toast, setToast] = useState(null);          // { person, index }
  const [editor, setEditor] = useState(null);        // null | { id } | { isNew: true }
  const [mode, setMode] = useState("view");          // "view": pick time · "edit": toggle hours
  const [sel, setSel] = useState(null);              // user-picked slot { start, len } in reference hours
  const [copied, setCopied] = useState(null);        // "share" | "invite"
  const [importText, setImportText] = useState(null);
  const [refTZ, setRefTZ] = useState(loadRefTZ);
  const drag = useRef(null);                         // { kind: "paint", pid, value } | { kind: "select", anchor }
  const lastPointer = useRef("mouse");
  const scroller = useRef(null);
  const peopleRef = useRef(people);
  peopleRef.current = people;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { savePeople(people); }, [people]);
  useEffect(() => {
    const stop = () => { drag.current = null; };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => { window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const applyLink = (fromLink) => {
    if (!fromLink) return;
    if (fromLink === "invalid") { setNotice({ kind: "badlink" }); return; }
    const current = peopleRef.current;
    const backup = sameConfig(current, fromLink) ? null : current;
    if (backup) rememberBackup(backup);
    setPeople(fromLink);
    setSel(null);
    setNotice({ kind: "link", backup });
  };
  useEffect(() => {
    const onHash = () => applyLink(takeHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const chooseRefTZ = (tz) => { setRefTZ(tz); saveRefTZ(tz); setSel(null); };

  /* derived */
  const refCity = cityFor(refTZ);
  const refOffset = getOffset(refTZ, now);
  const refNow = getTimeInTZ(refTZ, now).decimal;
  const nowCol = Math.floor(refNow);

  const enriched = useMemo(() => people.map(p => {
    const offset = getOffset(p.tz, now);
    return { ...p, offset, diff: offset - refOffset, local: getTimeInTZ(p.tz, now), hourSet: new Set(p.workHours) };
  }), [people, now, refOffset]);

  const golden = useMemo(() => findCommonWindow(enriched, refOffset), [enriched, refOffset]);
  const partial = useMemo(() => (golden ? null : findBestPartial(enriched, refOffset)), [golden, enriched, refOffset]);

  const suggested = golden?.best || partial?.best || null;
  const slot = sel || (suggested && { start: suggested.start, len: Math.min(suggested.end - suggested.start, MAX_LEN) });

  // next (or current) occurrence of the slot, as a real instant
  const slotInfo = useMemo(() => {
    if (!slot) return null;
    const into = mod24(refNow - slot.start);
    const live = into < slot.len;
    const startsIn = live ? -into : mod24(slot.start - refNow);
    const startAt = new Date(now.getTime() + startsIn * 3600e3);
    const rows = enriched.map(p => ({
      p, ok: freeForSlot(p.hourSet, slot.start, slot.len, p.diff),
      from: fmtTime(slot.start + p.diff), to: fmtTime(slot.start + slot.len + p.diff),
      day: weekday(startAt, p.tz),
    }));
    return { live, startsIn, startAt, rows, okCount: rows.filter(r => r.ok).length };
  }, [slot?.start, slot?.len, refNow, now, enriched]);

  const refDay = slotInfo && weekday(slotInfo.startAt, refTZ);
  const inSlot = (i) => slot && mod24(i - slot.start) < slot.len;

  // keep the picked slot (or "now") in view on narrow screens
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const col = slot ? slot.start : nowCol;
    const cell = el.querySelector(`[data-col="${col}"]`);
    if (cell) el.scrollLeft = Math.max(0, cell.offsetLeft - el.clientWidth / 2);
  }, [slot?.start, refTZ]);

  /* actions */
  const setHour = (pid, hour, value) => setPeople(prev => prev.map(p => {
    if (p.id !== pid || p.workHours.includes(hour) === value) return p;
    const workHours = value ? [...p.workHours, hour].sort((a, b) => a - b) : p.workHours.filter(h => h !== hour);
    return { ...p, workHours };
  }));

  const pickRange = (a, b) => {
    // shortest way from a to b going forward or backward
    const fwd = mod24(b - a), back = mod24(a - b);
    setSel(fwd <= back ? { start: a, len: Math.min(fwd + 1, MAX_LEN) } : { start: b, len: Math.min(back + 1, MAX_LEN) });
  };

  const changeLen = (d) => {
    if (!slot) return;
    setSel({ start: slot.start, len: Math.max(1, Math.min(MAX_LEN, slot.len + d)) });
  };

  const removePerson = (id) => {
    const index = people.findIndex(p => p.id === id);
    if (index < 0 || people.length <= 1) return;
    setPeople(prev => prev.filter(p => p.id !== id));
    setToast({ person: people[index], index });
    setEditor(null);
  };
  const undoRemove = () => {
    const { person, index } = toast;
    setPeople(prev => {
      const arr = [...prev];
      arr.splice(Math.min(index, arr.length), 0, { ...person, id: nextId(prev) });
      return arr;
    });
    setToast(null);
  };

  const saveEditor = (data) => {
    if (editor.isNew) setPeople(prev => [...prev, { id: nextId(prev), ...data }]);
    else setPeople(prev => prev.map(p => (p.id === editor.id ? { ...p, ...data } : p)));
    setEditor(null);
  };

  const flash = (what) => { setCopied(what); setTimeout(() => setCopied(null), 2000); };
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); flash(what); }
    catch { setNotice({ kind: "copy", text }); }
  };
  const share = () => copy(
    EMBED ? encodeConfig(people) : window.location.origin + window.location.pathname + "#" + encodeConfig(people),
    "share",
  );
  const inviteText = () => {
    const head = `Созвон: ${refDay} ${fmtTime(slot.start)}–${fmtTime(slot.start + slot.len)} (${refCity})`;
    const lines = slotInfo.rows.map(r => `${r.p.emoji} ${r.p.name} — ${r.day} ${r.from}–${r.to}${r.ok ? "" : " (вне рабочих часов)"}`);
    return [head, ...lines].join("\n");
  };
  const importCode = () => {
    if (!importText.trim()) return;
    applyLink(parseCode(importText));
    setImportText(null);
  };

  /* grid cell handlers */
  const cellDown = (e, p, i, localHour, isFree) => {
    lastPointer.current = e.pointerType;
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    e.preventDefault();
    if (mode === "edit") {
      drag.current = { kind: "paint", pid: p.id, value: !isFree };
      setHour(p.id, localHour, !isFree);
    } else {
      drag.current = { kind: "select", anchor: i };
      setSel({ start: i, len: 1 });
    }
  };
  const cellEnter = (e, p, i, localHour) => {
    const d = drag.current;
    if (!d) return;
    if (!(e.buttons & 1)) { drag.current = null; return; } // released outside the window
    if (d.kind === "paint" && d.pid === p.id) setHour(p.id, localHour, d.value);
    if (d.kind === "select") pickRange(d.anchor, i);
  };
  const cellClick = (p, i, localHour, isFree) => {
    if (lastPointer.current === "mouse") return; // handled on pointerdown
    if (mode === "edit") setHour(p.id, localHour, !isFree);
    else setSel({ start: i, len: sel?.len || 1 });
  };

  const editing = editor && !editor.isNew ? people.find(p => p.id === editor.id) : null;

  return (
    <div className="app">
      {/* header */}
      <header className="top">
        <div className="brand">
          <div className="brand-eyebrow">Timezone Sync</div>
          <h1>Найди окно для созвона</h1>
        </div>
        <div className="clock">
          <div className="clock-time">{now.toLocaleTimeString("en-GB", { timeZone: refTZ, hour: "2-digit", minute: "2-digit" })}</div>
          <div className="clock-meta">
            <span>{now.toLocaleDateString("ru-RU", { timeZone: refTZ, weekday: "short", day: "numeric", month: "long" })}</span>
            <label htmlFor="ref-tz">· мой пояс</label>
            <TzSelect id="ref-tz" value={refTZ} onChange={chooseRefTZ} now={now} />
          </div>
        </div>
      </header>

      {/* notices */}
      {notice?.kind === "link" && (
        <div className="notice" role="status">
          <span>Загружена конфигурация из {EMBED ? "кода" : "ссылки"}. Она сохранена как твоя.</span>
          {notice.backup && <button className="btn small" onClick={() => { setPeople(notice.backup); setNotice(null); }}>Вернуть мою</button>}
          <button className="btn small ghost" onClick={() => setNotice(null)}>Понятно</button>
        </div>
      )}
      {notice?.kind === "badlink" && (
        <div className="notice bad" role="alert">
          <span>{EMBED ? "Код повреждён или обрезан" : "Ссылка повреждена или обрезана"}. Показана твоя сохранённая конфигурация.</span>
          <button className="btn small ghost" onClick={() => setNotice(null)}>Понятно</button>
        </div>
      )}
      {notice?.kind === "copy" && (
        <div className="notice">
          <span style={{ flex: "0 0 auto", minWidth: 0 }}>Скопируй вручную:</span>
          <textarea id="copy-text" className="field mono" readOnly autoFocus rows={Math.min(6, notice.text.split("\n").length)}
            value={notice.text} onFocus={e => e.target.select()} style={{ flex: 1, minWidth: "200px", resize: "vertical" }} />
          <button className="btn small ghost" onClick={() => setNotice(null)}>Готово</button>
        </div>
      )}

      {/* the answer */}
      {slot ? (
        <section className={`slot${golden ? "" : " none"}`} aria-live="polite">
          <div className="slot-head">
            <div className="slot-eyebrow">
              {sel ? "Выбранное время" : golden ? "Лучшее общее окно" : "Общего окна нет"}
              {slotInfo.live
                ? <span className="pill live">● идёт сейчас</span>
                : <span className="pill">через {fmtDuration(slotInfo.startsIn * 60)}</span>}
              {slotInfo.okCount < people.length && <span className="pill warn">свободны {slotInfo.okCount} из {people.length}</span>}
            </div>
            <div className="slot-time">{fmtTime(slot.start)}–{fmtTime(slot.start + slot.len)}</div>
            <div className="slot-sub">
              <b>{refDay}</b>, по времени {refCity}
              {!golden && !sel && partial && (
                <> · больше всего свободных: {partial.count} из {partial.total}</>
              )}
            </div>
            <div className="slot-controls">
              <span className="dur" aria-label="Длительность">
                <button className="icon-btn" onClick={() => changeLen(-1)} disabled={slot.len <= 1} aria-label="Короче">−</button>
                <span className="dur-val">{fmtLen(slot.len)}</span>
                <button className="icon-btn" onClick={() => changeLen(1)} disabled={slot.len >= MAX_LEN} aria-label="Длиннее">+</button>
              </span>
              <button className={`btn${copied === "invite" ? " done" : " primary"}`} onClick={() => copy(inviteText(), "invite")}>
                {copied === "invite" ? "✓ Скопировано" : "Скопировать для чата"}
              </button>
            </div>
            {/* always rendered: the card must not change height while a range is being dragged */}
            <div className="chips">
                {golden ? <span>Общие окна:</span> : !sel && <span>Можно выбрать другое время на шкале ниже.</span>}
                {golden?.ranges.map(r => {
                  const on = slot.start === r.start && slot.len === Math.min(r.end - r.start, MAX_LEN);
                  return (
                    <button key={r.start} className={`chip${on ? " on" : ""}`}
                      onClick={() => setSel({ start: r.start, len: Math.min(r.end - r.start, MAX_LEN) })}>
                      {fmtHour(r.start)}–{fmtHour(r.end)}
                    </button>
                  );
                })}
                <button className="chip" onClick={() => setSel(null)} style={{ visibility: sel ? "visible" : "hidden" }}>↺ к лучшему</button>
            </div>
          </div>
          <div className="who">
            {slotInfo.rows.map(r => (
              <div key={r.p.id} className="who-row">
                <span>{r.p.emoji}</span>
                <span className="who-name">{r.p.name}<small>{r.p.city}</small></span>
                <span className="who-time">{r.from}–{r.to}{r.day !== refDay && <em>{r.day}</em>}</span>
                <span className={`mark ${r.ok ? "ok" : "no"}`} aria-label={r.ok ? "свободен" : "занят"}>{r.ok ? "✓" : "✕"}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="slot none">
          <div className="slot-head">
            <div className="slot-eyebrow">Общего окна нет</div>
            <div className="slot-sub">Ни у кого нет отмеченных часов. Нажми на участника и задай его рабочие часы.</div>
          </div>
        </section>
      )}

      {/* toolbar */}
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Что делает клик по шкале">
          <button className={mode === "view" ? "on" : ""} aria-pressed={mode === "view"} onClick={() => setMode("view")}>Выбор времени</button>
          <button className={mode === "edit" ? "on" : ""} aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>Правка часов</button>
        </div>
        <span className="spacer" />
        {importText === null ? (
          <>
            {EMBED && <button className="btn small" onClick={() => setImportText("")}>Вставить код</button>}
            <button className={`btn small${copied === "share" ? " done" : ""}`} onClick={share}>
              {copied === "share" ? "✓ Скопировано" : EMBED ? "Скопировать код" : "Поделиться ссылкой"}
            </button>
          </>
        ) : (
          <div className="import">
            <input id="import-code" className="field mono" autoFocus value={importText} placeholder="Вставь код или ссылку"
              onChange={e => setImportText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") importCode(); if (e.key === "Escape") setImportText(null); }} />
            <button className="btn small primary" onClick={importCode}>Загрузить</button>
            <button className="btn small ghost" onClick={() => setImportText(null)} aria-label="Отмена">✕</button>
          </div>
        )}
      </div>

      {/* day grid */}
      <div className={`grid-wrap ${mode}-mode`}>
        <div className="grid-scroll" ref={scroller}>
          <div className="grid" role="grid" aria-label="Часы участников по времени выбранного пояса">
            <div className="corner">{refCity}</div>
            {hoursRange(0, 24).map(i => (
              <button key={i} data-col={i} className={`hh${i === nowCol ? " now" : ""}${inSlot(i) ? " sel" : ""}`}
                onClick={() => setSel({ start: i, len: sel?.len || 1 })} aria-label={`Выбрать ${fmtHour(i)}`}>
                {pad(i)}
              </button>
            ))}

            {enriched.map(p => (
              <Row key={p.id} p={p} golden={golden} inSlot={inSlot} slot={slot} nowCol={nowCol} refNow={refNow} now={now}
                onEdit={() => setEditor({ id: p.id })}
                onDown={cellDown} onEnter={cellEnter} onClick={cellClick} />
            ))}

            {people.length < MAX_PEOPLE && (
              <button className="add-row" onClick={() => setEditor({ isNew: true })}>+ Добавить участника</button>
            )}
          </div>
        </div>
        <div className="grid-foot">
          <div className="legend">
            <span><i className="sw" style={{ background: "var(--free)" }} />рабочие часы</span>
            <span><i className="sw" style={{ background: "var(--accent-soft)", borderColor: "var(--accent-line)" }} />все свободны</span>
            <span><i className="sw" style={{ background: "var(--sleep)" }} />ночь (00–07)</span>
            <span><i className="sw" style={{ background: "var(--accent)", width: 3, border: 0 }} />сейчас</span>
          </div>
          <span>
            {mode === "view"
              ? "Нажми на час или протяни мышью, чтобы выбрать время. Цифры в ячейках — местное время."
              : "Нажми на ячейку, чтобы включить или выключить час. Мышью можно протянуть."}
          </span>
        </div>
      </div>

      {editor && (
        <Editor
          key={editor.isNew ? "new" : editor.id}
          isNew={!!editor.isNew}
          canDelete={people.length > 1}
          initial={editing || { name: "", city: cityFor(refTZ), tz: refTZ, workHours: hoursRange(9, 18) }}
          now={now}
          onSave={saveEditor}
          onDelete={() => removePerson(editor.id)}
          onClose={() => setEditor(null)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>Удалён: {toast.person.emoji} {toast.person.name}</span>
          <button className="btn small" onClick={undoRemove}>Отменить</button>
        </div>
      )}
    </div>
  );
}

function Row({ p, golden, inSlot, slot, nowCol, refNow, now, onEdit, onDown, onEnter, onClick }) {
  return (
    <>
      <button className="name" onClick={onEdit} title={`${p.city} · ${fmtOffset(p.offset)}\n${describeHours(p.workHours)}\nНажми, чтобы изменить`}>
        <span className="flag">{p.emoji}</span>
        <span className="name-text">
          <span className="name-main">{p.name}</span>
          <span className="name-sub"><b>{fmtTime(p.local.decimal)}</b> · {p.workHours.length} ч</span>
        </span>
      </button>
      {hoursRange(0, 24).map(i => {
        const localStart = mod24(i + p.diff);
        const localHour = localHourAt(i, p.diff);
        const shown = Number.isInteger(localStart) ? String(localHour) : fmtTime(localStart);
        const isFree = p.hourSet.has(localHour);
        const fits = coversRefHour(p.hourSet, i, p.diff);
        const common = golden && fits && golden.allHours.includes(i);
        const isDay = localStart < 1; // local midnight falls in this cell
        const sl = inSlot(i);
        const cls = ["cell"];
        if (isFree) cls.push("free"); else if (localHour < 7) cls.push("sleep");
        if (common) cls.push("common");
        if (isDay) cls.push("day");
        if (sl) {
          cls.push("sel");
          if (i === slot.start) cls.push("sel-l");
          if (mod24(i - slot.start) === slot.len - 1) cls.push("sel-r");
        }
        return (
          <div key={i} className={cls.join(" ")} role="gridcell"
            data-day={isDay ? new Date(now.getTime() + (i - refNow + 0.5) * 3600e3).toLocaleDateString("ru-RU", { timeZone: p.tz, weekday: "short" }) : undefined}
            title={`${p.name}: ${fmtTime(localStart)} — ${isFree ? "рабочий час" : "не работает"}`}
            onPointerDown={e => onDown(e, p, i, localHour, isFree)}
            onPointerEnter={e => onEnter(e, p, i, localHour)}
            onClick={() => onClick(p, i, localHour, isFree)}
          >
            {shown}
            {i === nowCol && <span className="nowline" style={{ left: `${(refNow % 1) * 100}%` }} />}
          </div>
        );
      })}
    </>
  );
}
