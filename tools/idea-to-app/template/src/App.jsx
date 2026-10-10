import { useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import qrcode from "qrcode-generator";
import { APP_NAME, SITE_URL, DONATE_URL, EMBED } from "./lib/config.js";
import { load, save, takeHash, copyText } from "./lib/storage.js";
import { encodeShare, decodeShare, shareLink } from "./lib/share.js";
import { parseKey, keyLink } from "./lib/sync.js";
import { useDeviceSync, SYNC_AVAILABLE } from "./lib/useDeviceSync.js";
import { fetchUsers } from "./lib/counter.js";
import { LANGS, langInfo, detectLang, saveLang, makeT, ensureFont, fmtNumber } from "./i18n.js";
import { sanitizeState, makeExample, addItem, toggleItem, removeItem, restoreItem } from "./core/model.js";
import "./styles.css";

/* ── start-up: language, saved state, then a link in the address bar (if any) ── */
const START_LANG = detectLang();
const START = (() => {
  const saved = sanitizeState(load("state"));
  const hash = takeHash();
  const sync = hash.match(/^sync\.([A-Za-z0-9_-]{22})$/);
  if (sync) return { state: saved || makeExample(makeT(START_LANG)), notice: SYNC_AVAILABLE ? { kind: "sync", key: sync[1] } : null };
  const shared = hash ? decodeShare(hash, sanitizeState) : null;
  if (shared && shared !== "invalid") {
    if (saved) save("backup", saved);           // a shared link never silently destroys your own data
    return { state: shared, notice: { kind: "loaded", backup: !!saved } };
  }
  return { state: saved || makeExample(makeT(START_LANG)), notice: shared === "invalid" ? { kind: "bad" } : null };
})();

const I18n = createContext({ lang: "en", t: makeT("en") });
const useI18n = () => useContext(I18n);

function applyDocumentLang(code) {
  const info = langInfo(code);
  document.documentElement.lang = info.locale;
  document.documentElement.dir = info.dir || "ltr";   // Arabic → RTL; CSS uses logical properties
  ensureFont(code);
  document.title = `${APP_NAME} — ${makeT(code)("title")}`;
}

/* ── language switcher: compact button + popover, native names with English hints ── */
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

/* ── minimalist on/off switch (white knob on a pill track; accent when on) ── */
export function Switch({ on, onChange, label, title }) {
  return (
    <button className="switch" role="switch" aria-checked={on} onClick={() => onChange(!on)} title={title}>
      <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>
      <span className="switch-label">{label}</span>
    </button>
  );
}

function QR({ text }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
  }, [text]);
  return <div className="qr" role="img" aria-label="QR" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/* ── device sync sheet: turn on (shows QR + link) or join with a code ── */
function SyncSheet({ sync, onClose }) {
  const { t, lang } = useI18n();
  const [code, setCode] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const { syncKey, status } = sync;
  const link = syncKey ? keyLink(syncKey) : "";
  const copyLink = async () => {
    if (await copyText(link)) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else document.getElementById("sync-link")?.select();
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
                <button className="btn primary" onClick={sync.enable}>{t("syncEnable")}</button>
                <button className="btn ghost" onClick={() => setCode("")}>{t("syncHaveCode")}</button>
              </div>
            ) : (
              <div className="row">
                <input className="field mono" autoFocus value={code} placeholder={t("syncCodePh")}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && parseKey(code)) sync.join(parseKey(code)); }} />
                <button className="btn small primary" disabled={!parseKey(code)} onClick={() => sync.join(parseKey(code))}>{t("syncConnect")}</button>
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
          {syncKey && <button className="btn ghost danger" onClick={sync.disconnect}>{t("syncDisconnect")}</button>}
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
  const [state, setState] = useState(START.state);
  const [notice, setNotice] = useState(START.notice);
  const [toast, setToast] = useState(null);           // { removed } for Undo
  const [copied, setCopied] = useState(null);         // which button just copied
  const [manual, setManual] = useState(null);         // text to copy by hand when the clipboard is blocked
  const [importText, setImportText] = useState(null); // null = paste field hidden
  const [syncOpen, setSyncOpen] = useState(false);
  const [users, setUsers] = useState(null);
  const [draft, setDraft] = useState("");
  const sync = useDeviceSync(state, setState, sanitizeState);

  useEffect(() => { applyDocumentLang(lang); }, [lang]);
  useEffect(() => { save("state", state); }, [state]);
  useEffect(() => { fetchUsers().then(setUsers); }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  // a link pasted into an already open tab
  useEffect(() => {
    const onHash = () => {
      const hash = takeHash();
      const sk = hash.match(/^sync\.([A-Za-z0-9_-]{22})$/);
      if (sk) { if (SYNC_AVAILABLE) setNotice({ kind: "sync", key: sk[1] }); return; }
      applyShared(decodeShare(hash, sanitizeState));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  });

  const chooseLang = (code) => { setLang(code); saveLang(code); };
  const applyShared = (shared) => {
    if (!shared) return;
    if (shared === "invalid") { setNotice({ kind: "bad" }); return; }
    save("backup", state);
    setState(shared);
    setNotice({ kind: "loaded", backup: true });
  };
  const restoreMine = () => {
    const backup = sanitizeState(load("backup"));
    if (backup) setState(backup);
    setNotice(null);
  };
  const copy = async (text, what) => {
    if (await copyText(text)) { setCopied(what); setTimeout(() => setCopied(null), 2000); }
    else setManual(text);
  };
  const remove = (id) => {
    const r = removeItem(state, id);
    setState(r.state);
    if (r.removed) setToast({ removed: r.removed });
  };

  return (
    <I18n.Provider value={i18n}>
    <div className="app">
      <div className="topbar">
        <div className="brand-eyebrow" lang="en" dir="ltr">{APP_NAME}</div>
        <span className="spacer" />
        {EMBED && <a className="btn small ghost" href={`${SITE_URL}/#${encodeShare(state)}`} target="_blank" rel="noopener noreferrer">{t("openOnSite")}</a>}
        <LangSwitcher lang={lang} onChange={chooseLang} />
      </div>
      <header className="top"><h1>{t("title")}</h1></header>

      {notice?.kind === "loaded" && (
        <div className="notice" role="status">
          <span>{t("loadedLink")}</span>
          {notice.backup && <button className="btn small" onClick={restoreMine}>{t("restoreMine")}</button>}
          <button className="btn small ghost" onClick={() => setNotice(null)}>{t("gotIt")}</button>
        </div>
      )}
      {notice?.kind === "bad" && (
        <div className="notice bad" role="alert">
          <span>{t("badLink")}</span>
          <button className="btn small ghost" onClick={() => setNotice(null)}>{t("gotIt")}</button>
        </div>
      )}
      {notice?.kind === "sync" && (
        <div className="notice" role="alertdialog" aria-labelledby="sync-ask">
          <span><b id="sync-ask">{t("syncAskTitle")}</b> {notice.key === sync.syncKey ? "" : t("syncAskText")}</span>
          <button className="btn small primary" onClick={() => { sync.join(notice.key); setNotice(null); setSyncOpen(true); }}>{t("syncConnect")}</button>
          <button className="btn small ghost" onClick={() => setNotice(null)}>{t("cancel")}</button>
        </div>
      )}
      {manual && (
        <div className="notice" role="status">
          <span>{t("copyManually")}</span>
          <input className="field mono" readOnly value={manual} autoFocus onFocus={e => e.target.select()} />
          <button className="btn small" onClick={() => setManual(null)}>{t("done")}</button>
        </div>
      )}

      {/* ── DEMO CONTENT: replace with the real app; keep "answer first", big touch targets ── */}
      <main className="card">
        <form className="row" onSubmit={e => { e.preventDefault(); setState(addItem(state, draft)); setDraft(""); }}>
          <input className="field" value={draft} placeholder={t("itemPh")} onChange={e => setDraft(e.target.value)} />
          <button className="btn primary" disabled={!draft.trim()}>{t("add")}</button>
        </form>
        {state.items.length === 0 ? <p className="empty">{t("empty")}</p> : (
          <ul className="list">
            {state.items.map(it => (
              <li key={it.id} className={it.done ? "done" : ""}>
                <label><input type="checkbox" checked={it.done} onChange={() => setState(toggleItem(state, it.id))} /> <span>{it.text}</span></label>
                <button className="icon-btn" aria-label={t("delete")} title={t("delete")} onClick={() => remove(it.id)}>×</button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="toolbar">
        {!EMBED && <button className={`btn small${copied === "link" ? " done" : ""}`} onClick={() => copy(shareLink(state), "link")}>{copied === "link" ? t("copied") : t("shareLink")}</button>}
        <button className={`btn small${copied === "code" ? " done" : ""}`} onClick={() => copy(encodeShare(state), "code")}>{copied === "code" ? t("copied") : t("copyCode")}</button>
        <button className="btn small ghost" onClick={() => setImportText(v => (v === null ? "" : null))}>{t("pasteCode")}</button>
        <span className="spacer" />
        {SYNC_AVAILABLE && (
          <button className={`btn small sync-btn${sync.syncKey ? " on" : ""}`} onClick={() => setSyncOpen(true)}>
            {sync.syncKey ? (sync.status.state === "offline" ? "…" : t("syncOn")) : t("syncBtn")}
          </button>
        )}
      </div>
      {importText !== null && (
        <div className="row">
          <input className="field mono" autoFocus value={importText} placeholder={t("pastePh")} onChange={e => setImportText(e.target.value)} />
          <button className="btn small primary" onClick={() => { applyShared(decodeShare(importText, sanitizeState) || "invalid"); setImportText(null); }}>{t("load")}</button>
          <button className="btn small ghost" onClick={() => setImportText(null)}>{t("cancel")}</button>
        </div>
      )}

      {(users || DONATE_URL) && (
        <footer className="foot">
          {users && <span className="foot-count" title={t("usersTip")}>{t("usersCount", { n: fmtNumber(lang, users) })}</span>}
          <span className="spacer" />
          {DONATE_URL && <a className="donate" href={DONATE_URL} target="_blank" rel="noopener noreferrer">{t("donate")}</a>}
        </footer>
      )}

      {syncOpen && <SyncSheet sync={sync} onClose={() => setSyncOpen(false)} />}
      {toast && (
        <div className="toast" role="status">
          <span>{t("removed", { name: toast.removed.item.text })}</span>
          <button className="btn small" onClick={() => { setState(restoreItem(state, toast.removed)); setToast(null); }}>{t("undo")}</button>
        </div>
      )}
    </div>
    </I18n.Provider>
  );
}
