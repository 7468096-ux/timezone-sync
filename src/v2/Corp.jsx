/* ── Company mode: plan a call inside one organisation ──
   One time zone for everyone; what gets in the way is colleagues' meetings, lunch and the working day.
   Layout follows the World planner: the answer first (nearest free time + who is free), then a strip of
   days, then the day grid in 15-minute steps. All logic lives in src/lib/corp.js. */
import { useState, useEffect, useMemo, useRef } from "react";
import { useI18n } from "./common.jsx";
import { langInfo, fmtDuration } from "./i18n.js";
import { EMBED } from "../lib/storage.js";
import { cityFor } from "../lib/config.js";
import {
  STEP, MAX_CALL, MAX_COLLEAGUES, MAX_BLOCKS, nowIn, toInstant, fmtMin, weekday, dateAsUTC, addDays,
  busyOn, conflictsAt, commonFree, findCall, daySummary, workdaysAhead, nextIdOf, buildIcs,
} from "../lib/corp.js";

const LS_LEN = "tz-sync-corp-len";
const STRIP_DAYS = 10;
const loadLen = () => {
  try { const n = Number(localStorage.getItem(LS_LEN)); if (n >= STEP && n <= MAX_CALL && n % STEP === 0) return n; } catch {}
  return 30;
};

// Calendar date "YYYY-MM-DD" in the interface language (digits stay Latin, like the rest of the app)
const fmtDate = (lang, date, opts) =>
  dateAsUTC(date).toLocaleDateString(`${langInfo(lang).locale}-u-nu-latn`, { timeZone: "UTC", ...opts });
const shortDate = (lang, date) => fmtDate(lang, date, { weekday: "short", day: "numeric", month: "short" });
const longDate = (lang, date) => fmtDate(lang, date, { weekday: "long", day: "numeric", month: "long" });
const wdName = (lang, d, style = "short") => // d: 0 = Sunday; 2023-01-01 was a Sunday
  fmtDate(lang, addDays("2023-01-01", d), { weekday: style });

// Times inside right-to-left text: keep "10:00–10:15" reading left to right (Unicode isolate)
const ltr = (lang, str) => (langInfo(lang).dir === "rtl" ? `\u2066${str}\u2069` : str);
const range = (lang, a, b) => ltr(lang, `${fmtMin(a)}–${fmtMin(b)}`);

// Every 15 minutes of the day, for time selects
const TIMES = Array.from({ length: 1440 / STEP + 1 }, (_, i) => i * STEP);

function useEsc(onClose, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, active]);
}

function TimeSelect({ id, value, onChange, min = 0, max = 1440 }) {
  return (
    <select id={id} className="select num" value={value} onChange={e => onChange(+e.target.value)}>
      {TIMES.filter(m => m >= min && m <= max).map(m => <option key={m} value={m}>{fmtMin(m)}</option>)}
      {!TIMES.includes(value) && <option value={value}>{fmtMin(value)}</option>}
    </select>
  );
}

function Switch({ on, onToggle, label, title }) {
  return (
    <button type="button" className="switch" role="switch" aria-checked={on} onClick={onToggle} title={title}>
      <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>
      <span className="switch-label">{label}</span>
    </button>
  );
}

// How a meeting repeats, in words: "every workday · 10:00–10:15" / "Wed, 15 Oct · 14:00–15:30"
function blockWhen(t, lang, b) {
  const time = range(lang, b.start, b.end);
  const when = b.repeat === "daily" ? t("everyWorkday")
    : b.repeat === "weekly" ? t("everyWeekday", { day: wdName(lang, weekday(b.date), "long") })
    : shortDate(lang, b.date);
  return b.start === 0 && b.end === 1440 ? `${when} · ${t("allDay")}` : `${when} · ${time}`;
}

/* ── sheets ── */
function ColleagueSheet({ colleague, isNew, canDelete, covered, onSave, onDelete, onClose, onOpenBlock, onAddBlock }) {
  const { t, lang } = useI18n();
  const [name, setName] = useState(colleague?.name ?? "");
  const [role, setRole] = useState(colleague?.role ?? "");
  useEsc(onClose, !covered);
  const save = () => { if (name.trim()) onSave({ name: name.trim(), role: role.trim() }); };
  const blocks = colleague ? [...colleague.blocks].sort((a, b) =>
    (a.repeat === "once") - (b.repeat === "once") || (a.repeat === "once" ? a.date.localeCompare(b.date) : 0) || a.start - b.start) : [];
  return (
    <div className="backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="col-title"
        onKeyDown={e => { if (e.key === "Enter" && e.target.tagName === "INPUT") save(); }}>
        <h2 id="col-title">{isNew ? t("newColleague") : t("colleague")}</h2>
        <div className="form-row">
          <label className="label">{t("nameLabel")}
            <input id="col-name" className="field" autoFocus value={name} maxLength={40} placeholder={t("colleagueNamePh")} onChange={e => setName(e.target.value)} />
          </label>
          <label className="label">{t("roleLabel")}
            <input id="col-role" className="field" value={role} maxLength={40} placeholder={t("rolePh")} onChange={e => setRole(e.target.value)} />
          </label>
        </div>
        {!isNew && (
          <div className="label">{t("meetingsLabel")}
            {blocks.length ? (
              <div className="mlist">
                {blocks.map(b => (
                  <button key={b.id} type="button" className="mrow" onClick={() => onOpenBlock(b)}>
                    <span className="mrow-title">{b.title || t("meetingDefault")}</span>
                    <span className="mrow-when">{blockWhen(t, lang, b)}</span>
                  </button>
                ))}
              </div>
            ) : <p className="sheet-text">{t("noMeetings")}</p>}
            {colleague.blocks.length < MAX_BLOCKS && (
              <div><button type="button" className="btn small" onClick={onAddBlock}>{t("addMeeting")}</button></div>
            )}
          </div>
        )}
        <div className="sheet-actions">
          {!isNew && canDelete && <button type="button" className="btn ghost danger" onClick={onDelete}>{t("delete")}</button>}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>{t("cancel")}</button>
          <button type="button" className="btn primary" disabled={!name.trim()} onClick={save}>{isNew ? t("add") : t("save")}</button>
        </div>
      </div>
    </div>
  );
}

function BlockSheet({ corp, draft, isNew, onSave, onDelete, onClose }) {
  const { t, lang } = useI18n();
  const [cid, setCid] = useState(draft.cid);
  const [title, setTitle] = useState(draft.title ?? "");
  const [date, setDate] = useState(draft.date);
  const [start, setStart] = useState(draft.start);
  const [end, setEnd] = useState(draft.end);
  const [repeat, setRepeat] = useState(draft.repeat ?? "once");
  useEsc(onClose);
  const valid = end > start && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const save = () => { if (valid) onSave(cid, { title: title.trim(), date, start, end, repeat }); };
  const allDay = start === 0 && end === 1440;
  const repeats = [["once", t("repeatOnce")], ["daily", t("repeatDaily")], ["weekly", t("repeatWeekly")]];
  return (
    <div className="backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="blk-title"
        onKeyDown={e => { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "date") save(); }}>
        <h2 id="blk-title">{isNew ? t("newMeeting") : t("meeting")}</h2>
        <div className="form-row">
          <label className="label">{t("titleLabel")}
            <input id="blk-name" className="field" autoFocus value={title} maxLength={40} placeholder={t("titlePh")} onChange={e => setTitle(e.target.value)} />
          </label>
          <label className="label">{t("whoLabel")}
            <select id="blk-who" className="field" value={cid} onChange={e => setCid(+e.target.value)}>
              {corp.colleagues.map(c => <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ""}</option>)}
            </select>
          </label>
        </div>
        <div className="label">{t("repeatLabel")}
          <div className="seg seg-wrap" role="group" aria-label={t("repeatLabel")}>
            {repeats.map(([k, label]) => (
              <button key={k} type="button" className={repeat === k ? "on" : ""} aria-pressed={repeat === k} onClick={() => setRepeat(k)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label className="label">{repeat === "once" ? t("dateLabel") : t("startsOn")}
            <input id="blk-date" type="date" className="field num" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
          </label>
          <div className="label">{t("timeLabel")}
            <div className="range-set">
              <TimeSelect id="blk-from" value={start} max={1440 - STEP} onChange={v => { setStart(v); if (end <= v) setEnd(Math.min(1440, v + 30)); }} />
              <span>–</span>
              <TimeSelect id="blk-to" value={end} min={STEP} onChange={setEnd} />
              <button type="button" className={`chip${allDay ? " on" : ""}`} onClick={() => { setStart(0); setEnd(1440); }}>{t("allDay")}</button>
            </div>
          </div>
        </div>
        <p className="sheet-text" aria-live="polite">
          {valid ? blockWhen(t, lang, { date, start, end, repeat }) : <span className="bad-text">{t("endBeforeStart")}</span>}
        </p>
        <div className="sheet-actions">
          {!isNew && <button type="button" className="btn ghost danger" onClick={onDelete}>{t("delete")}</button>}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>{t("cancel")}</button>
          <button type="button" className="btn primary" disabled={!valid} onClick={save}>{isNew ? t("add") : t("save")}</button>
        </div>
      </div>
    </div>
  );
}

function CompanySheet({ corp, onSave, onStartOver, onClose }) {
  const { t, lang } = useI18n();
  const [dayStart, setDayStart] = useState(corp.day.start);
  const [dayEnd, setDayEnd] = useState(corp.day.end);
  const [workdays, setWorkdays] = useState(new Set(corp.workdays));
  const [lunchOn, setLunchOn] = useState(!!corp.lunch);
  const [lunchStart, setLunchStart] = useState(corp.lunch?.start ?? 780);
  const [lunchEnd, setLunchEnd] = useState(corp.lunch?.end ?? 840);
  useEsc(onClose);
  const lunchOk = !lunchOn || (lunchEnd > lunchStart && lunchStart >= dayStart && lunchEnd <= dayEnd);
  const valid = dayEnd > dayStart && workdays.size > 0 && lunchOk;
  const toggleDay = (d) => setWorkdays(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });
  const save = () => valid && onSave({
    day: { start: dayStart, end: dayEnd }, workdays: [...workdays].sort((a, b) => a - b),
    lunch: lunchOn ? { start: lunchStart, end: lunchEnd } : null,
  });
  // Monday first, the way work weeks are usually shown
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="co-title">
        <h2 id="co-title">{t("companySettings")}</h2>
        <div className="label">{t("workDayLabel")}
          <div className="range-set">
            <TimeSelect id="co-from" value={dayStart} max={1440 - STEP} onChange={setDayStart} />
            <span>–</span>
            <TimeSelect id="co-to" value={dayEnd} min={STEP} onChange={setDayEnd} />
          </div>
        </div>
        <div className="label">{t("workdaysLabel")}
          <div className="presets">
            {order.map(d => (
              <button key={d} type="button" className={`chip${workdays.has(d) ? " on" : ""}`} aria-pressed={workdays.has(d)} onClick={() => toggleDay(d)}>
                {wdName(lang, d)}
              </button>
            ))}
          </div>
        </div>
        <div className="label">
          <Switch on={lunchOn} onToggle={() => setLunchOn(v => !v)} label={t("lunchOn")} />
          {lunchOn && (
            <div className="range-set">
              <TimeSelect id="co-lunch-from" value={lunchStart} onChange={setLunchStart} />
              <span>–</span>
              <TimeSelect id="co-lunch-to" value={lunchEnd} onChange={setLunchEnd} />
            </div>
          )}
        </div>
        {!valid && <p className="sheet-text bad-text">{dayEnd <= dayStart || !lunchOk ? t("endBeforeStart") : t("pickWorkdays")}</p>}
        <div className="sheet-actions">
          <button type="button" className="btn ghost danger" onClick={onStartOver}>{t("startOver")}</button>
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>{t("cancel")}</button>
          <button type="button" className="btn primary" disabled={!valid} onClick={save}>{t("save")}</button>
        </div>
      </div>
    </div>
  );
}

/* ── the planner ── */
export default function CorpPlanner({ corp, setCorp, now, tools, onCopy, copied }) {
  const { t, lang } = useI18n();
  const [tool, setTool] = useState("view");          // "view": pick a time · "edit": add or change meetings
  const [len, setLenRaw] = useState(loadLen);       // call length, minutes
  const setLen = (v) => { setLenRaw(v); try { localStorage.setItem(LS_LEN, String(v)); } catch {} };
  const lenRef = useRef(len);
  lenRef.current = len;
  const [viewDay, setViewDay] = useState(null);      // null = today
  const [sel, setSel] = useState(null);              // user-picked { date, start, len }
  const [sheet, setSheet] = useState(null);          // { kind: "colleague", id } | { kind: "colleague", isNew } | { kind: "company" }
  const [blockSheet, setBlockSheet] = useState(null); // { draft: {cid, id?, …}, isNew }
  const [draft, setDraft] = useState(null);          // meeting being drawn: { cid, a, b } quarter indexes
  const [toast, setToast] = useState(null);          // { text, undo }
  const drag = useRef(null);
  const lastPointer = useRef("mouse");
  const scroller = useRef(null);

  const { date: today, min: nowMin } = nowIn(corp.tz, now);
  const day = viewDay && viewDay >= today ? viewDay : today;
  const city = cityFor(corp.tz);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const res = useMemo(() => findCall(corp, { from: day, today, nowMin, len }), [corp, day, today, nowMin, len]);
  const invited = res.invited;
  const suggested = res.slot || res.partial?.slot || null;
  const slot = sel || suggested;

  // grid range: whole hours around the working day
  const gStart = Math.floor(corp.day.start / 60) * 60;
  const gEnd = Math.ceil(corp.day.end / 60) * 60;
  const Q = (gEnd - gStart) / STEP;
  const qMin = (q) => gStart + q * STEP;

  const dayIsWork = corp.workdays.includes(weekday(day));
  const common = useMemo(() => commonFree(corp, day, invited, today, nowMin), [corp, day, invited, today, nowMin]);
  const inCommon = (m) => common.some(f => m >= f.start && m + STEP <= f.end);
  const offAt = (m) => !dayIsWork || m < corp.day.start || m + STEP > corp.day.end
    || (corp.lunch && m < corp.lunch.end && corp.lunch.start < m + STEP);

  const strip = useMemo(() => workdaysAhead(corp, today, 28).slice(0, STRIP_DAYS)
    .map(d => ({ date: d, ...daySummary(corp, d, today, nowMin, len) })), [corp, today, nowMin, len]);

  // the answer card
  const info = useMemo(() => {
    if (!slot) return null;
    const startAt = toInstant(slot.date, slot.start, corp.tz);
    const mins = (startAt - now.getTime()) / 60e3;
    const live = mins <= 0 && mins > -slot.len;
    const rows = corp.colleagues.map(c => ({ c, conflicts: c.on ? conflictsAt(c, slot.date, slot.start, slot.len, corp) : [] }));
    const okCount = rows.filter(r => r.c.on && !r.conflicts.length).length;
    const wd = weekday(slot.date);
    const why = !corp.workdays.includes(wd) ? t("dayOff")
      : slot.start < corp.day.start || slot.start + slot.len > corp.day.end ? t("outsideDay")
      : corp.lunch && slot.start < corp.lunch.end && corp.lunch.start < slot.start + slot.len ? t("lunchTime") : null;
    return { startAt, mins, live, past: mins <= -slot.len, rows, okCount, why };
  }, [slot?.date, slot?.start, slot?.len, corp, now, lang]);

  // keep the picked time in view on narrow screens
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth || !slot || slot.date !== day) return;
    const q = Math.floor((slot.start - gStart) / STEP);
    const cell = el.querySelector(`[data-q="${q}"]`);
    if (cell) el.scrollLeft = Math.max(0, cell.offsetLeft - el.clientWidth / 3);
  }, [slot?.start, slot?.date, day]);

  /* actions */
  const updateColleague = (id, fn) => setCorp(prev => ({ ...prev, colleagues: prev.colleagues.map(c => (c.id === id ? fn(c) : c)) }));
  const toggleInvite = (id) => updateColleague(id, c => ({ ...c, on: !c.on }));
  const changeLen = (d) => {
    const next = Math.max(STEP, Math.min(MAX_CALL, (slot?.len ?? len) + d));
    setLen(next);
    if (sel) setSel({ ...sel, len: next });
  };
  const pickDay = (d) => { setViewDay(d); setSel(null); };
  const pickWindow = (w) => { setViewDay(w.date); setSel({ date: w.date, start: w.start, len }); };

  const saveColleague = (data) => {
    if (sheet.isNew) setCorp(prev => ({ ...prev, colleagues: [...prev.colleagues, { id: nextIdOf(prev.colleagues), on: true, blocks: [], ...data }] }));
    else updateColleague(sheet.id, c => ({ ...c, ...data }));
    setSheet(null);
  };
  const removeColleague = (id) => {
    const index = corp.colleagues.findIndex(c => c.id === id);
    if (index < 0 || corp.colleagues.length <= 1) return;
    const removed = corp.colleagues[index];
    setCorp(prev => ({ ...prev, colleagues: prev.colleagues.filter(c => c.id !== id) }));
    setSheet(null);
    setToast({
      text: t("removed", { name: removed.name }),
      undo: () => setCorp(prev => {
        const arr = [...prev.colleagues];
        arr.splice(Math.min(index, arr.length), 0, { ...removed, id: nextIdOf(prev.colleagues) });
        return { ...prev, colleagues: arr };
      }),
    });
  };
  const openNewBlock = (cid, date, start, end) =>
    setBlockSheet({ isNew: true, draft: { cid, date, start, end: Math.min(1440, end), title: "", repeat: "once" } });
  const saveBlock = (cid, data) => {
    const { draft: d, isNew } = blockSheet;
    setCorp(prev => ({
      ...prev,
      colleagues: prev.colleagues.map(c => {
        let blocks = c.blocks;
        if (!isNew && c.id === d.cid) blocks = blocks.filter(b => b.id !== d.id);        // moved away or edited
        if (c.id === cid) blocks = [...blocks, { ...data, id: !isNew && cid === d.cid ? d.id : nextIdOf(c.blocks) }];
        return blocks === c.blocks ? c : { ...c, blocks };
      }),
    }));
    setBlockSheet(null);
  };
  const removeBlock = () => {
    const { draft: d } = blockSheet;
    const owner = corp.colleagues.find(c => c.id === d.cid);
    const block = owner?.blocks.find(b => b.id === d.id);
    if (!block) return setBlockSheet(null);
    updateColleague(d.cid, c => ({ ...c, blocks: c.blocks.filter(b => b.id !== d.id) }));
    setBlockSheet(null);
    setToast({
      text: t("removed", { name: block.title || t("meetingDefault") }),
      undo: () => updateColleague(d.cid, c => ({ ...c, blocks: [...c.blocks, { ...block, id: nextIdOf(c.blocks) }] })),
    });
  };
  const saveCompany = (settings) => { setCorp(prev => ({ ...prev, ...settings })); setSheet(null); setSel(null); };
  const startOver = () => {
    const before = corp;
    setCorp(prev => ({ ...prev, colleagues: [{ id: 1, name: t("you"), role: "", on: true, blocks: [] }] }));
    setSheet(null);
    setSel(null);
    setToast({ text: t("startedOver"), undo: () => setCorp(before) });
  };

  const inviteText = () => {
    const head = t("inviteHead", { day: shortDate(lang, slot.date), from: fmtMin(slot.start), to: fmtMin(slot.start + slot.len), city });
    const lines = info.rows.filter(r => r.c.on).map(r =>
      `• ${r.c.name}${r.c.role ? ` (${r.c.role})` : ""}${r.conflicts.length ? ` — ${t("busyWith", { what: r.conflicts.map(b => b.title || t("meetingDefault")).join(", ") })}` : ""}`);
    return [head, ...lines].join("\n");
  };
  const downloadIcs = () => {
    const names = invited.map(c => c.name).join(", ");
    const ics = buildIcs({ title: t("icsTitle"), date: slot.date, start: slot.start, len: slot.len, tz: corp.tz, description: names, now });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-${slot.date}-${fmtMin(slot.start).replace(":", "")}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* grid pointer handling: same rules as the World grid (global pointerup ends a drag) */
  useEffect(() => {
    const stop = () => {
      const d = drag.current;
      drag.current = null;
      if (d?.kind === "paint") {
        setDraft(null);
        const a = Math.min(d.a, d.b), b = Math.max(d.a, d.b);
        // a plain click proposes a meeting as long as the call; a drag uses the dragged range
        openNewBlock(d.cid, d.date, qMin(a), a === b ? qMin(a) + lenRef.current : qMin(b) + STEP);
      }
    };
    const cancel = () => { drag.current = null; setDraft(null); };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", cancel);
    return () => { window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", cancel); };
  }, [gStart]);

  const cellDown = (e, c, q) => {
    lastPointer.current = e.pointerType;
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    e.preventDefault();
    if (tool === "edit") {
      drag.current = { kind: "paint", cid: c.id, a: q, b: q, date: day };
      setDraft({ cid: c.id, a: q, b: q });
    } else {
      drag.current = { kind: "select", anchor: q };
      setSel({ date: day, start: qMin(q), len: slot?.len ?? len });
    }
  };
  const cellEnter = (e, c, q) => {
    const d = drag.current;
    if (!d) return;
    if (!(e.buttons & 1)) { drag.current = null; setDraft(null); return; } // released outside the window
    if (d.kind === "paint" && d.cid === c.id) { d.b = q; setDraft({ cid: c.id, a: d.a, b: q }); }
    if (d.kind === "select" && q !== d.anchor) {
      const a = Math.min(d.anchor, q), b = Math.max(d.anchor, q);
      const l = Math.min(MAX_CALL, (b - a + 1) * STEP);
      setSel({ date: day, start: qMin(a), len: l });
      setLen(l);
    }
  };
  const cellClick = (c, q) => {
    if (lastPointer.current === "mouse") return; // handled on pointerdown
    if (tool === "edit") openNewBlock(c.id, day, qMin(q), qMin(q) + (slot?.len ?? len));
    else setSel({ date: day, start: qMin(q), len: slot?.len ?? len });
  };

  const nowQ = day === today && nowMin >= gStart && nowMin < gEnd ? (nowMin - gStart) / STEP : null;
  const selOnDay = slot && slot.date === day;
  const selQ0 = selOnDay ? Math.max(0, (slot.start - gStart) / STEP) : 0;
  const selQ1 = selOnDay ? Math.min(Q, (slot.start + slot.len - gStart) / STEP) : 0;
  const n = corp.colleagues.length;
  const editingColleague = sheet?.kind === "colleague" && !sheet.isNew ? corp.colleagues.find(c => c.id === sheet.id) : null;
  const windows = res.windows.slice(0, 5);

  return (
    <>
      {/* the answer */}
      {slot && info ? (
        <section className={`slot${(sel ? info.okCount === invited.length && !info.why && !info.past : !!res.slot) ? "" : " none"}`} aria-live="polite">
          <div className="slot-head">
            <div className="slot-eyebrow">
              {sel ? t("picked") : res.slot ? t("corpNearest") : t("corpNoAll")}
              {info.live ? <span className="pill live">{t("liveNow")}</span>
                : info.past ? <span className="pill warn">{t("corpPast")}</span>
                : <span className="pill">{t("startsIn", { d: fmtDuration(lang, Math.ceil(info.mins)) })}</span>}
              {invited.length > 0 && info.okCount < invited.length && <span className="pill warn">{t("freeOf", { n: info.okCount, total: invited.length })}</span>}
              {info.why && <span className="pill warn">{info.why}</span>}
            </div>
            <div className="slot-time">{fmtMin(slot.start)}–{fmtMin(slot.start + slot.len)}</div>
            <div className="slot-sub"><b>{longDate(lang, slot.date)}</b> · {t("cityTime", { city })}</div>
            <div className="slot-controls">
              <span className="dur" aria-label={t("duration")}>
                <button className="icon-btn" onClick={() => changeLen(-STEP)} disabled={slot.len <= STEP} aria-label={t("shorter")}>−</button>
                <span className="dur-val">{fmtDuration(lang, slot.len)}</span>
                <button className="icon-btn" onClick={() => changeLen(STEP)} disabled={slot.len >= MAX_CALL} aria-label={t("longer")}>+</button>
              </span>
              <button className={`btn${copied === "corp-invite" ? " done" : " primary"}`} onClick={() => onCopy(inviteText(), "corp-invite")}>
                {copied === "corp-invite" ? t("copied") : t("copyForChat")}
              </button>
              {!EMBED && <button className="btn" onClick={downloadIcs}>{t("addToCalendar")}</button>}
            </div>
            {/* always rendered: the card must not change height while a range is being dragged */}
            <div className="chips">
              {windows.length > 0 ? <span>{t("corpWindows")}</span> : !sel && <span>{t("pickOther")}</span>}
              {windows.map(w => {
                const on = sel && sel.date === w.date && sel.start === w.start;
                return (
                  <button key={`${w.date}-${w.start}`} className={`chip${on ? " on" : ""}`} onClick={() => pickWindow(w)}>
                    {w.date === today ? "" : `${fmtDate(lang, w.date, { weekday: "short" })} `}{range(lang, w.start, w.end)}
                  </button>
                );
              })}
              <button className="chip" onClick={() => setSel(null)} style={{ visibility: sel ? "visible" : "hidden" }}>{t("backToNearest")}</button>
            </div>
          </div>
          <div className="who">
            {info.rows.map(({ c, conflicts }) => (
              <div key={c.id} className={`who-row corp${c.on ? "" : " out"}`}>
                <button className={`check${c.on ? " on" : ""}`} role="checkbox" aria-checked={c.on}
                  aria-label={`${t("invitedAria")}: ${c.name}`} onClick={() => toggleInvite(c.id)}>{c.on ? "✓" : ""}</button>
                <span className="who-name">
                  {c.name}{c.role && <small>{c.role}</small>}
                  {conflicts.length > 0 && <span className="who-why">{conflicts.map(b => `${b.title || t("meetingDefault")} ${range(lang, b.start, b.end)}`).join(" · ")}</span>}
                </span>
                <span className={`mark ${!c.on ? "" : conflicts.length ? "no" : "ok"}`} aria-label={!c.on ? t("notInvited") : conflicts.length ? t("busy") : t("free")}>
                  {!c.on ? "—" : conflicts.length ? "✕" : "✓"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="slot none">
          <div className="slot-head">
            <div className="slot-eyebrow">{invited.length ? t("corpNoAll") : t("noWindow")}</div>
            <div className="slot-sub">{invited.length ? t("corpNothing") : t("corpNobody")}</div>
            {invited.length > 0 && (
              <div className="slot-controls">
                <span className="dur" aria-label={t("duration")}>
                  <button className="icon-btn" onClick={() => changeLen(-STEP)} disabled={len <= STEP} aria-label={t("shorter")}>−</button>
                  <span className="dur-val">{fmtDuration(lang, len)}</span>
                  <button className="icon-btn" onClick={() => changeLen(STEP)} disabled={len >= MAX_CALL} aria-label={t("longer")}>+</button>
                </span>
              </div>
            )}
          </div>
          {!invited.length && (
            <div className="who">
              {corp.colleagues.map(c => (
                <div key={c.id} className="who-row corp out">
                  <button className="check" role="checkbox" aria-checked={false} aria-label={`${t("invitedAria")}: ${c.name}`} onClick={() => toggleInvite(c.id)} />
                  <span className="who-name">{c.name}{c.role && <small>{c.role}</small>}</span>
                  <span className="mark">—</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* toolbar */}
      <div className="toolbar">
        <div className="seg" role="group" aria-label={t("modeGroup")}>
          <button className={tool === "view" ? "on" : ""} aria-pressed={tool === "view"} onClick={() => setTool("view")}>{t("modeView")}</button>
          <button className={tool === "edit" ? "on" : ""} aria-pressed={tool === "edit"} onClick={() => setTool("edit")}>{t("corpModeEdit")}</button>
        </div>
        <button className="btn small" onClick={() => setSheet({ kind: "company" })}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3" />
          </svg>
          {t("companySettings")}
        </button>
        <span className="spacer" />
        {tools}
      </div>

      {/* days */}
      <div className="strip" role="group" aria-label={t("stripAria")}>
        {strip.map(s => (
          <button key={s.date} className={`sday${s.date === day ? " on" : ""}${slot?.date === s.date ? " has-slot" : ""}`}
            aria-pressed={s.date === day} onClick={() => pickDay(s.date)}
            title={`${longDate(lang, s.date)} · ${fmtDuration(lang, s.minutes)}`}>
            <span className="sday-wd">{s.date === today ? t("today") : fmtDate(lang, s.date, { weekday: "short" })}</span>
            <span className="sday-num">{fmtDate(lang, s.date, { day: "numeric" })}</span>
            <span className={`sday-bar${s.fits ? " fits" : s.minutes ? " some" : ""}`} aria-hidden="true" />
          </button>
        ))}
      </div>

      {/* day grid */}
      <div className={`grid-wrap ${tool === "edit" ? "edit" : "view"}-mode`}>
        <div className="grid-scroll" ref={scroller}>
          <div className="cgrid" role="grid" aria-label={t("corpGridLabel")}
            style={{
              gridTemplateColumns: `var(--name-col) repeat(${Q}, minmax(var(--qmin), 1fr))`,
              gridTemplateRows: `auto repeat(${n}, 48px) auto`,
              // fixed minimum, never wider than needed: meeting titles must not stretch the columns
              minWidth: `calc(var(--name-col) + ${Q} * var(--qmin))`,
            }}>
            <div className="corner" style={{ gridRow: 1, gridColumn: 1 }}>{shortDate(lang, day)}</div>
            {Array.from({ length: Q / 4 }, (_, h) => (
              <button key={h} className={`hh chh${nowQ !== null && Math.floor(nowQ / 4) === h ? " now" : ""}`}
                style={{ gridRow: 1, gridColumn: `${2 + h * 4} / span 4` }}
                onClick={() => setSel({ date: day, start: gStart + h * 60, len: slot?.len ?? len })}
                aria-label={t("pickHour", { time: fmtMin(gStart + h * 60) })}>
                {fmtMin(gStart + h * 60)}
              </button>
            ))}

            {corp.colleagues.map((c, i) => {
              const row = i + 2;
              const blocks = busyOn(c, day, corp).filter(b => b.end > gStart && b.start < gEnd);
              const busyAt = (m) => blocks.some(b => m < b.end && b.start < m + STEP);
              return [
                <button key={`n${c.id}`} className={`name${c.on ? "" : " out"}`} style={{ gridRow: row, gridColumn: 1 }}
                  onClick={() => setSheet({ kind: "colleague", id: c.id })} title={`${c.name}${c.role ? ` · ${c.role}` : ""}\n${t("editTip")}`}>
                  <span className="name-text">
                    <span className="name-main">{c.name}</span>
                    <span className="name-sub">{c.role || (c.on ? t("invitedShort") : t("notInvited"))}</span>
                  </span>
                </button>,
                ...Array.from({ length: Q }, (_, q) => {
                  const m = qMin(q);
                  const cls = ["q"];
                  if (offAt(m)) cls.push("off");
                  else if (!busyAt(m)) cls.push(c.on && inCommon(m) ? "common" : "free");
                  if (q % 4 === 0) cls.push("qh");
                  if (day === today && m + STEP <= nowMin) cls.push("past");
                  if (!c.on) cls.push("out");
                  return (
                    <div key={`${c.id}-${q}`} data-q={i === 0 ? q : undefined} className={cls.join(" ")} role="gridcell"
                      style={{ gridRow: row, gridColumn: 2 + q }}
                      title={`${c.name}: ${fmtMin(m)}–${fmtMin(m + STEP)}`}
                      onPointerDown={e => cellDown(e, c, q)}
                      onPointerEnter={e => cellEnter(e, c, q)}
                      onClick={() => cellClick(c, q)} />
                  );
                }),
                ...blocks.map(b => {
                  const a = Math.max(0, Math.floor((b.start - gStart) / STEP));
                  const z = Math.min(Q, Math.ceil((b.end - gStart) / STEP));
                  const clash = selOnDay && c.on && slot.start < b.end && b.start < slot.start + slot.len;
                  return (
                    <button key={`b${c.id}-${b.id}`} type="button" className={`cblock${clash ? " clash" : ""}${c.on ? "" : " out"}`}
                      style={{ gridRow: row, gridColumn: `${2 + a} / ${2 + z}` }}
                      tabIndex={tool === "edit" ? 0 : -1}
                      title={`${b.title || t("meetingDefault")} · ${blockWhen(t, lang, b)}`}
                      onClick={() => tool === "edit" && setBlockSheet({ isNew: false, draft: { ...b, cid: c.id } })}>
                      <span>{b.title || t("meetingDefault")}</span>
                    </button>
                  );
                }),
                draft && draft.cid === c.id && (
                  <div key={`d${c.id}`} className="cdraft" aria-hidden="true"
                    style={{ gridRow: row, gridColumn: `${2 + Math.min(draft.a, draft.b)} / ${3 + Math.max(draft.a, draft.b)}` }}>
                    {fmtMin(qMin(Math.min(draft.a, draft.b)))}–{fmtMin(qMin(Math.max(draft.a, draft.b)) + STEP)}
                  </div>
                ),
              ];
            })}

            {selOnDay && selQ1 > selQ0 && (
              <div className="csel" aria-hidden="true" style={{ gridRow: `2 / ${n + 2}`, gridColumn: `${2 + Math.floor(selQ0)} / ${2 + Math.ceil(selQ1)}` }} />
            )}
            {nowQ !== null && (
              <div className="cnow" aria-hidden="true" style={{ gridRow: `1 / ${n + 2}`, gridColumn: 2 + Math.floor(nowQ), "--x": `${(nowQ % 1) * 100}%` }} />
            )}

            {n < MAX_COLLEAGUES && (
              <button className="add-row cadd" style={{ gridRow: n + 2, gridColumn: "1 / -1" }} onClick={() => setSheet({ kind: "colleague", isNew: true })}><span>{t("addColleague")}</span></button>
            )}
          </div>
        </div>
        <div className="grid-foot">
          <div className="legend">
            <span><i className="sw" style={{ background: "var(--free)" }} />{t("corpLegendFree")}</span>
            <span><i className="sw" style={{ background: "var(--accent-soft)", borderColor: "var(--accent-line)" }} />{t("corpLegendAll")}</span>
            <span><i className="sw sw-block" />{t("corpLegendBusy")}</span>
            <span><i className="sw" style={{ background: "repeating-linear-gradient(135deg, transparent 0 3px, var(--night) 3px 4px)" }} />{t("corpLegendOff")}</span>
          </div>
          <span>{!dayIsWork ? t("dayOff") : tool === "edit" ? t("corpHintEdit") : t("corpHintView")}</span>
        </div>
      </div>

      {sheet?.kind === "colleague" && (
        <ColleagueSheet
          key={sheet.isNew ? "new" : sheet.id}
          colleague={editingColleague} isNew={!!sheet.isNew} canDelete={n > 1} covered={!!blockSheet}
          onSave={saveColleague} onDelete={() => removeColleague(sheet.id)} onClose={() => setSheet(null)}
          onOpenBlock={b => setBlockSheet({ isNew: false, draft: { ...b, cid: sheet.id } })}
          onAddBlock={() => openNewBlock(sheet.id, day, 600, 660)}
        />
      )}
      {sheet?.kind === "company" && (
        <CompanySheet corp={corp} onSave={saveCompany} onStartOver={startOver} onClose={() => setSheet(null)} />
      )}
      {blockSheet && (
        <BlockSheet key={`${blockSheet.draft.cid}-${blockSheet.draft.id ?? "new"}`} corp={corp} draft={blockSheet.draft} isNew={blockSheet.isNew}
          onSave={saveBlock} onDelete={removeBlock} onClose={() => setBlockSheet(null)} />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          <button className="btn small" onClick={() => { toast.undo(); setToast(null); }}>{t("undo")}</button>
        </div>
      )}
    </>
  );
}
