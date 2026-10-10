import { useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import {
  getTimeInTZ, getOffset, fmtTime, fmtOffset, localHourAt, describeHours, findCommonWindow,
  findBestPartial, freeForSlot, coversRefHour, hoursRange, mod24,
} from "../lib/time.js";
import { MAX_PEOPLE, flagFor, cityFor, allTimeZones, sortedCommonTZ, encodeConfig, sanitizePeople } from "../lib/config.js";
import {
  EMBED, consumeMigration, loadInitial, savePeople, takeHash, parseCode, sameConfig, rememberBackup, loadRefTZ, saveRefTZ, nextId, detectTZ,
} from "../lib/storage.js";
import {
  LANGS, langInfo, detectLang, saveLang, makeT, splitTemplate, fmtUnit, fmtDuration, fmtWeekday, fmtLongDate,
  ensureFont, makeDefaults,
} from "./i18n.js";
import {
  SYNC_ENABLED, newKey, parseKey, keyLink, pull as syncPull, push as syncPush, loadKey, saveKey, loadMeta, saveMeta,
} from "../lib/sync.js";
import qrcode from "qrcode-generator";
import "./styles.css";

consumeMigration(); // before anything reads saved settings
const START_LANG = detectLang();
const exampleTeam = (lang) => sanitizePeople(makeDefaults(lang, detectTZ()));
const INITIAL = loadInitial(() => exampleTeam(START_LANG));
const MAX_LEN = 12;
const SITE_URL = "https://timezone-sync.com.co";

const I18n = createContext({ lang: "en", t: makeT("en") });
const useI18n = () => useContext(I18n);

const pad = (n) => String(n).padStart(2, "0");
const fmtHour = (h) => `${pad(mod24(h))}:00`;

// Apply language to the document: lang/dir attributes (drive per-script CSS), font, title
function applyDocumentLang(code) {
  const info = langInfo(code);
  const root = document.documentElement;
  root.lang = info.locale;
  root.dir = info.dir || "ltr";
  ensureFont(code);
  document.title = `Timezone Sync — ${makeT(code)("title")}`;
}

/* ── language switcher: compact button + popover list in speaker order ── */
function LangSwitcher({ lang, onChange }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    box.current?.querySelector('[aria-checked="true"]')?.focus();
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const cur = langInfo(lang);
  return (
    <div className="lang" ref={box}>
      <button className="lang-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`${t("language")}: ${cur.native}`}
        onClick={() => setOpen(o => !o)}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </svg>
        <span lang={cur.locale}>{cur.native}</span>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className="caret"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      {open && (
        <div className="lang-menu" role="menu" aria-label={t("language")}>
          {LANGS.map(l => (
            <button key={l.code} role="menuitemradio" aria-checked={l.code === lang} className="lang-item"
              onClick={() => { onChange(l.code); setOpen(false); }}>
              <span className="lang-native" lang={l.locale} dir={l.dir || "ltr"}>{l.native}</span>
              <span className="lang-en">{l.english}</span>
              <span className="lang-check" aria-hidden="true">{l.code === lang ? "✓" : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── timezone select ── */
function TzSelect({ id, value, onChange, now, className = "select" }) {
  const { t } = useI18n();
  const common = useMemo(() => sortedCommonTZ(now), [now.getUTCHours()]); // offsets only change on hour boundaries
  const others = useMemo(() => {
    const known = new Set(common.map(c => c.tz));
    return allTimeZones().filter(tz => !known.has(tz));
  }, [common]);
  const inList = common.some(c => c.tz === value) || others.includes(value);
  return (
    <select id={id} className={className} value={value} onChange={e => onChange(e.target.value)}>
      {!inList && <option value={value}>{cityFor(value)} ({fmtOffset(getOffset(value, now))})</option>}
      <optgroup label={t("popular")}>
        {common.map(c => <option key={c.tz} value={c.tz}>{c.label} ({fmtOffset(c.offset)})</option>)}
      </optgroup>
      {others.length > 0 && (
        <optgroup label={t("allZones")}>
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
  ["allDay", hoursRange(0, 24)],
  ["clear", []],
];

function Editor({ initial, isNew, canDelete, now, onSave, onDelete, onClose }) {
  const { t, lang } = useI18n();
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
        <h2 id="ed-title">{isNew ? t("newParticipant") : t("participant")}</h2>
        <div className="form-row">
          <label className="label">{t("nameLabel")}
            <input id="ed-name" className="field" autoFocus value={name} maxLength={40} placeholder={t("namePh")} onChange={e => setName(e.target.value)} />
          </label>
          <label className="label">{t("cityLabel")}
            <input id="ed-city" className="field" value={city} maxLength={40} placeholder={cityFor(tz)} onChange={e => setCity(e.target.value)} />
          </label>
          <label className="label full"><span>{splitTemplate(t("tzLabel")).map((p, i) => (typeof p === "string" ? p : <span key={i} className="num">{fmtTime(localNow.decimal)}</span>))}</span>
            <TzSelect id="ed-tz" className="field" value={tz} onChange={setTz} now={now} />
          </label>
        </div>

        <div className="label">{t("hoursLabel")}
          <div className="presets">
            {PRESETS.map(([label, list]) => (
              <button key={label} type="button" className="chip" onClick={() => setHours(new Set(list))}>{/^\d/.test(label) ? <span className="num">{label}</span> : t(label)}</button>
            ))}
          </div>
          <div className="range-set">
            {splitTemplate(t("range")).map((p, i) => {
              if (typeof p === "string") return <span key={i}>{p.trim()}</span>;
              const [val, set] = p.slot === "from" ? [from, setFrom] : [to, setTo];
              return (
                <select key={i} id={`ed-${p.slot}`} className="select" value={val} onChange={e => set(+e.target.value)}>
                  {hoursRange(0, 24).map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
                </select>
              );
            })}
            <button type="button" className="btn small" onClick={applyRange}>{t("set")}</button>
          </div>
          <div className="hours" aria-label={t("hoursAria")}>
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
          <div className="hours-sum">{sorted.length ? `${describeHours(sorted)} · ${fmtUnit(lang, sorted.length, "hour")}` : t("noHours")}</div>
        </div>

        <div className="sheet-actions">
          {!isNew && canDelete && <button type="button" className="btn ghost danger" onClick={onDelete}>{t("delete")}</button>}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>{t("cancel")}</button>
          <button type="button" className="btn primary" onClick={save}>{isNew ? t("add") : t("save")}</button>
        </div>
      </div>
    </div>
  );
}

/* ── device sync sheet ── */
const SYNC_AVAILABLE = SYNC_ENABLED && !EMBED;

function QR({ text }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
  }, [text]);
  return <div className="qr" role="img" aria-label="QR" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function SyncSheet({ syncKey, status, onEnable, onJoin, onDisconnect, onClose }) {
  const { t, lang } = useI18n();
  const [code, setCode] = useState(null); // null = field hidden
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const link = syncKey ? keyLink(syncKey) : "";
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { document.getElementById("sync-link")?.select(); }
  };
  const statusText = status.state === "busy" ? t("syncStatusBusy")
    : status.state === "offline" ? t("syncStatusOffline")
    : status.at ? t("syncStatusOk", { time: new Date(status.at).toLocaleTimeString(`${langInfo(lang).locale}-u-nu-latn`, { hour: "2-digit", minute: "2-digit" }) })
    : "";
  return (
    <div className="backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sync-title">
        <h2 id="sync-title">{t("syncTitle")}</h2>
        {!syncKey ? (
          <>
            <p className="sheet-text">{t("syncIntro")}</p>
            {status.state === "notfound" && <div className="notice bad" role="alert"><span>{t("syncNotFound")}</span></div>}
            {code === null ? (
              <div className="sheet-actions">
                <button className="btn primary" onClick={onEnable}>{t("syncEnable")}</button>
                <button className="btn ghost" onClick={() => setCode("")}>{t("syncHaveCode")}</button>
              </div>
            ) : (
              <div className="import">
                <input id="sync-code" className="field mono" autoFocus value={code} placeholder={t("syncCodePh")}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && parseKey(code)) onJoin(parseKey(code)); }} />
                <button className="btn small primary" disabled={!parseKey(code)} onClick={() => onJoin(parseKey(code))}>{t("syncConnect")}</button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="sheet-text">{t("syncScan")}</p>
            <div className="sync-pair">
              <QR text={link} />
              <div className="sync-side">
                <input id="sync-link" className="field mono" readOnly value={link} onFocus={e => e.target.select()} />
                <button className={`btn small${copied ? " done" : ""}`} onClick={copyLink}>{copied ? t("copied") : t("syncCopyLink")}</button>
                <p className="sync-warn">{t("syncKeepSecret")}</p>
              </div>
            </div>
            <div className={`sync-status ${status.state}`} role="status">{statusText}</div>
          </>
        )}
        <div className="sheet-actions">
          {syncKey && <button className="btn ghost danger" onClick={onDisconnect}>{t("syncDisconnect")}</button>}
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>{t("close")}</button>
        </div>
      </div>
    </div>
  );
}

/* ── app ── */
export default function App() {
  const [lang, setLang] = useState(START_LANG);
  const t = useMemo(() => makeT(lang), [lang]);
  const i18n = useMemo(() => ({ lang, t }), [lang, t]);
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
  const [syncKey, setSyncKey] = useState(() => (SYNC_AVAILABLE ? loadKey() : null));
  const [syncStatus, setSyncStatus] = useState({ state: "idle", at: loadMeta().syncedAt || 0 });
  const [syncOpen, setSyncOpen] = useState(false);
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

  /* ── device sync: push local edits, pull the other device's ── */
  const meta = useRef(loadMeta());          // { localAt, remoteAt, syncedAt }
  const fromRemote = useRef(false);         // the next people change came from the server
  const firstPeople = useRef(true);
  const pushTimer = useRef(null);
  const busy = useRef(false);
  const keyRef = useRef(syncKey);
  keyRef.current = syncKey;
  const writeMeta = (m) => { meta.current = { ...meta.current, ...m }; saveMeta(meta.current); };

  const doPush = async () => {
    const key = keyRef.current;
    if (!key) return;
    setSyncStatus(s => ({ ...s, state: "busy" }));
    try {
      const at = meta.current.localAt || Date.now();
      const r = await syncPush(key, { people: peopleRef.current }, at);
      if (r.ok) { writeMeta({ localAt: at, remoteAt: at, syncedAt: Date.now() }); setSyncStatus({ state: "ok", at: Date.now() }); }
      else await doPull(); // the other device was newer
    } catch { setSyncStatus(s => ({ ...s, state: "offline" })); }
  };

  // joining: true when this device just entered a key and must take the remote copy
  const doPull = async (joining = false) => {
    const key = keyRef.current;
    if (!key || busy.current) return;
    busy.current = true;
    setSyncStatus(s => ({ ...s, state: "busy" }));
    try {
      const r = await syncPull(key);
      if (!r.found) {
        if (joining) { setSyncKey(null); saveKey(null); saveMeta(null); setSyncStatus({ state: "notfound", at: 0 }); return; }
        busy.current = false;
        await doPush();
        return;
      }
      const { localAt, remoteAt } = meta.current;
      const people = sanitizePeople(r.payload?.people);
      if (r.updatedAt > remoteAt && (joining || r.updatedAt > localAt) && people) {
        fromRemote.current = true;
        setPeople(people);
        setSel(null);
        writeMeta({ localAt: r.updatedAt, remoteAt: r.updatedAt, syncedAt: Date.now() });
        setSyncStatus({ state: "ok", at: Date.now() });
      } else if (localAt > Math.max(remoteAt, r.updatedAt)) {
        busy.current = false;
        await doPush();
        return;
      } else {
        writeMeta({ syncedAt: Date.now() });
        setSyncStatus({ state: "ok", at: Date.now() });
      }
    } catch { setSyncStatus(s => ({ ...s, state: "offline" })); }
    finally { busy.current = false; }
  };

  // every local edit: remember when, push a moment later
  useEffect(() => {
    if (firstPeople.current) { firstPeople.current = false; return; }
    if (fromRemote.current) { fromRemote.current = false; return; }
    writeMeta({ localAt: Date.now() });
    if (!keyRef.current) return;
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(doPush, 800);
  }, [people]);

  // pull on start, every 20 s while visible, and when the tab comes back or the network returns
  useEffect(() => {
    if (!syncKey) return;
    const tick = () => { if (document.visibilityState === "visible") doPull(); };
    tick();
    const iv = setInterval(tick, 20000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", tick); window.removeEventListener("online", tick); };
  }, [syncKey]);

  const enableSync = () => {
    const key = newKey();
    saveKey(key);
    keyRef.current = key;
    writeMeta({ localAt: meta.current.localAt || Date.now(), remoteAt: 0 });
    setSyncKey(key);
    doPush();
  };
  const joinSync = (key) => {
    saveKey(key);
    keyRef.current = key;
    meta.current = { localAt: 0, remoteAt: 0, syncedAt: 0 };
    saveMeta(meta.current);
    setNotice(null);
    setSyncKey(key);
    setSyncOpen(true);
    doPull(true);
  };
  const disconnectSync = () => {
    saveKey(null);
    saveMeta(null);
    meta.current = { localAt: 0, remoteAt: 0, syncedAt: 0 };
    keyRef.current = null;
    setSyncKey(null);
    setSyncStatus({ state: "idle", at: 0 });
  };
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
    if (fromLink.sync) { if (SYNC_AVAILABLE) setNotice({ kind: "sync", key: fromLink.sync }); return; }
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

  useEffect(() => { applyDocumentLang(lang); }, [lang]);
  const chooseLang = (code) => {
    // an untouched example team follows the language switch
    const prev = exampleTeam(lang);
    if (prev && sameConfig(people, prev)) setPeople(exampleTeam(code));
    setLang(code);
    saveLang(code);
  };

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
      day: fmtWeekday(lang, startAt, p.tz),
    }));
    return { live, startsIn, startAt, rows, okCount: rows.filter(r => r.ok).length };
  }, [slot?.start, slot?.len, refNow, now, enriched, lang]);

  const refDay = slotInfo && fmtWeekday(lang, slotInfo.startAt, refTZ);
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
    const head = t("inviteHead", { day: refDay, from: fmtTime(slot.start), to: fmtTime(slot.start + slot.len), city: refCity });
    const lines = slotInfo.rows.map(r => `${r.p.emoji} ${r.p.name} — ${r.day} ${r.from}–${r.to}${r.ok ? "" : ` ${t("outsideHours")}`}`);
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
    <I18n.Provider value={i18n}>
    <div className="app">
      {/* header */}
      <div className="topbar">
        <div className="brand-eyebrow" lang="en" dir="ltr">Timezone Sync</div>
        <LangSwitcher lang={lang} onChange={chooseLang} />
      </div>
      <header className="top">
        <div className="brand">
          <h1>{t("title")}</h1>
        </div>
        <div className="clock">
          <div className="clock-time">{now.toLocaleTimeString("en-GB", { timeZone: refTZ, hour: "2-digit", minute: "2-digit" })}</div>
          <div className="clock-meta">
            <span>{fmtLongDate(lang, now, refTZ)}</span>
            <label htmlFor="ref-tz">· {t("myZone")}</label>
            <TzSelect id="ref-tz" value={refTZ} onChange={chooseRefTZ} now={now} />
          </div>
        </div>
      </header>

      {/* notices */}
      {notice?.kind === "link" && (
        <div className="notice" role="status">
          <span>{t(EMBED ? "loadedCode" : "loadedLink")}</span>
          {notice.backup && <button className="btn small" onClick={() => { setPeople(notice.backup); setNotice(null); }}>{t("restoreMine")}</button>}
          <button className="btn small ghost" onClick={() => setNotice(null)}>{t("gotIt")}</button>
        </div>
      )}
      {notice?.kind === "badlink" && (
        <div className="notice bad" role="alert">
          <span>{t(EMBED ? "badCode" : "badLink")}</span>
          <button className="btn small ghost" onClick={() => setNotice(null)}>{t("gotIt")}</button>
        </div>
      )}
      {notice?.kind === "sync" && SYNC_AVAILABLE && (
        <div className="notice" role="alertdialog" aria-labelledby="sync-ask">
          <span><b id="sync-ask">{t("syncAskTitle")}</b> {notice.key === syncKey ? "" : t("syncAskText")}</span>
          <button className="btn small primary" onClick={() => joinSync(notice.key)}>{t("syncConnect")}</button>
          <button className="btn small ghost" onClick={() => setNotice(null)}>{t("cancel")}</button>
        </div>
      )}
      {notice?.kind === "copy" && (
        <div className="notice">
          <span style={{ flex: "0 0 auto", minWidth: 0 }}>{t("copyManually")}</span>
          <textarea id="copy-text" className="field mono" readOnly autoFocus rows={Math.min(6, notice.text.split("\n").length)}
            value={notice.text} onFocus={e => e.target.select()} style={{ flex: 1, minWidth: "200px", resize: "vertical" }} />
          <button className="btn small ghost" onClick={() => setNotice(null)}>{t("done")}</button>
        </div>
      )}

      {/* the answer */}
      {slot ? (
        <section className={`slot${golden ? "" : " none"}`} aria-live="polite">
          <div className="slot-head">
            <div className="slot-eyebrow">
              {sel ? t("picked") : golden ? t("bestWindow") : t("noWindow")}
              {slotInfo.live
                ? <span className="pill live">{t("liveNow")}</span>
                : <span className="pill">{t("startsIn", { d: fmtDuration(lang, slotInfo.startsIn * 60) })}</span>}
              {slotInfo.okCount < people.length && <span className="pill warn">{t("freeOf", { n: slotInfo.okCount, total: people.length })}</span>}
            </div>
            <div className="slot-time">{fmtTime(slot.start)}–{fmtTime(slot.start + slot.len)}</div>
            <div className="slot-sub">
              <b>{refDay}</b> · {t("cityTime", { city: refCity })}
              {!golden && !sel && partial && (
                <> · {t("mostFree", { n: partial.count, total: partial.total })}</>
              )}
            </div>
            <div className="slot-controls">
              <span className="dur" aria-label={t("duration")}>
                <button className="icon-btn" onClick={() => changeLen(-1)} disabled={slot.len <= 1} aria-label={t("shorter")}>−</button>
                <span className="dur-val">{fmtUnit(lang, slot.len, "hour")}</span>
                <button className="icon-btn" onClick={() => changeLen(1)} disabled={slot.len >= MAX_LEN} aria-label={t("longer")}>+</button>
              </span>
              <button className={`btn${copied === "invite" ? " done" : " primary"}`} onClick={() => copy(inviteText(), "invite")}>
                {copied === "invite" ? t("copied") : t("copyForChat")}
              </button>
            </div>
            {/* always rendered: the card must not change height while a range is being dragged */}
            <div className="chips">
                {golden ? <span>{t("commonWindows")}</span> : !sel && <span>{t("pickOther")}</span>}
                {golden?.ranges.map(r => {
                  const on = slot.start === r.start && slot.len === Math.min(r.end - r.start, MAX_LEN);
                  return (
                    <button key={r.start} className={`chip${on ? " on" : ""}`}
                      onClick={() => setSel({ start: r.start, len: Math.min(r.end - r.start, MAX_LEN) })}>
                      {fmtHour(r.start)}–{fmtHour(r.end)}
                    </button>
                  );
                })}
                <button className="chip" onClick={() => setSel(null)} style={{ visibility: sel ? "visible" : "hidden" }}>{t("backToBest")}</button>
            </div>
          </div>
          <div className="who">
            {slotInfo.rows.map(r => (
              <div key={r.p.id} className="who-row">
                <span>{r.p.emoji}</span>
                <span className="who-name">{r.p.name}<small>{r.p.city}</small></span>
                <span className="who-time">{r.from}–{r.to}{r.day !== refDay && <em>{r.day}</em>}</span>
                <span className={`mark ${r.ok ? "ok" : "no"}`} aria-label={r.ok ? t("free") : t("busy")}>{r.ok ? "✓" : "✕"}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="slot none">
          <div className="slot-head">
            <div className="slot-eyebrow">{t("noWindow")}</div>
            <div className="slot-sub">{t("nobodyHours")}</div>
          </div>
        </section>
      )}

      {/* toolbar */}
      <div className="toolbar">
        <div className="seg" role="group" aria-label={t("modeGroup")}>
          <button className={mode === "view" ? "on" : ""} aria-pressed={mode === "view"} onClick={() => setMode("view")}>{t("modeView")}</button>
          <button className={mode === "edit" ? "on" : ""} aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>{t("modeEdit")}</button>
        </div>
        <span className="spacer" />
        {importText === null ? (
          <>
            {SYNC_AVAILABLE && (
              <button className={`btn small sync-btn${syncKey ? " on" : ""}`} onClick={() => setSyncOpen(true)}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5H7z" />
                  {syncKey && <path d="M9.5 13.5l2 2 3.5-3.5" />}
                </svg>
                {syncKey ? (syncStatus.state === "offline" ? "…" : t("syncOn")) : t("syncBtn")}
              </button>
            )}
            {EMBED && (
              // the Claude page can't share its storage with the site: hand the setup over in the link
              <a className="btn small primary" href={`${SITE_URL}/#${encodeConfig(people)}`} target="_blank" rel="noopener noreferrer">
                {t("openOnSite")}
              </a>
            )}
            <button className="btn small" onClick={() => setImportText("")}>{t("pasteCode")}</button>
            <button className={`btn small${copied === "share" ? " done" : ""}`} onClick={share}>
              {copied === "share" ? t("copied") : EMBED ? t("copyCode") : t("shareLink")}
            </button>
          </>
        ) : (
          <div className="import">
            <input id="import-code" className="field mono" autoFocus value={importText} placeholder={t("pastePh")}
              onChange={e => setImportText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") importCode(); if (e.key === "Escape") setImportText(null); }} />
            <button className="btn small primary" onClick={importCode}>{t("load")}</button>
            <button className="btn small ghost" onClick={() => setImportText(null)} aria-label={t("cancel")}>✕</button>
          </div>
        )}
      </div>

      {/* day grid */}
      <div className={`grid-wrap ${mode}-mode`}>
        <div className="grid-scroll" ref={scroller}>
          <div className="grid" role="grid" aria-label={t("gridLabel")}>
            <div className="corner">{refCity}</div>
            {hoursRange(0, 24).map(i => (
              <button key={i} data-col={i} className={`hh${i === nowCol ? " now" : ""}${inSlot(i) ? " sel" : ""}`}
                onClick={() => setSel({ start: i, len: sel?.len || 1 })} aria-label={t("pickHour", { time: fmtHour(i) })}>
                {pad(i)}
              </button>
            ))}

            {enriched.map(p => (
              <Row key={p.id} p={p} golden={golden} inSlot={inSlot} slot={slot} nowCol={nowCol} refNow={refNow} now={now}
                onEdit={() => setEditor({ id: p.id })}
                onDown={cellDown} onEnter={cellEnter} onClick={cellClick} />
            ))}

            {people.length < MAX_PEOPLE && (
              <button className="add-row" onClick={() => setEditor({ isNew: true })}>{t("addParticipant")}</button>
            )}
          </div>
        </div>
        <div className="grid-foot">
          <div className="legend">
            <span><i className="sw" style={{ background: "var(--free)" }} />{t("legendWork")}</span>
            <span><i className="sw" style={{ background: "var(--accent-soft)", borderColor: "var(--accent-line)" }} />{t("legendAll")}</span>
            <span><i className="sw" style={{ background: "var(--sleep)" }} />{t("legendNight")}</span>
            <span><i className="sw" style={{ background: "var(--accent)", width: 3, border: 0 }} />{t("legendNow")}</span>
          </div>
          <span>
            {mode === "view" ? t("hintView") : t("hintEdit")}
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

      {syncOpen && (
        <SyncSheet syncKey={syncKey} status={syncStatus}
          onEnable={enableSync} onJoin={joinSync} onDisconnect={disconnectSync} onClose={() => setSyncOpen(false)} />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{t("removed", { name: `${toast.person.emoji} ${toast.person.name}` })}</span>
          <button className="btn small" onClick={undoRemove}>{t("undo")}</button>
        </div>
      )}
    </div>
    </I18n.Provider>
  );
}

function Row({ p, golden, inSlot, slot, nowCol, refNow, now, onEdit, onDown, onEnter, onClick }) {
  const { t, lang } = useI18n();
  return (
    <>
      <button className="name" onClick={onEdit} title={`${p.city} · ${fmtOffset(p.offset)}\n${describeHours(p.workHours)}\n${t("editTip")}`}>
        <span className="flag">{p.emoji}</span>
        <span className="name-text">
          <span className="name-main">{p.name}</span>
          <span className="name-sub"><b>{fmtTime(p.local.decimal)}</b> · {fmtUnit(lang, p.workHours.length, "hour")}</span>
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
            data-day={isDay ? fmtWeekday(lang, new Date(now.getTime() + (i - refNow + 0.5) * 3600e3), p.tz) : undefined}
            title={`${p.name}: ${fmtTime(localStart)} — ${isFree ? t("cellWork") : t("cellOff")}`}
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
