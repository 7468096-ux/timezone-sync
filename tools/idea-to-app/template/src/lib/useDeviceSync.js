/* ── React hook: keeps `state` in sync across one person's devices ──
   Pushes local edits (debounced), pulls on start, every 20 s while visible, on focus and when back online.
   Newer copy wins; a device that joins with a key takes the remote copy. */
import { useEffect, useRef, useState } from "react";
import {
  SYNC_ENABLED, newKey, pull, push, loadKey, saveKey, loadMeta, saveMeta,
} from "./sync.js";
import { EMBED } from "./config.js";

export const SYNC_AVAILABLE = SYNC_ENABLED && !EMBED;

export function useDeviceSync(state, setState, sanitize) {
  const [syncKey, setSyncKey] = useState(() => (SYNC_AVAILABLE ? loadKey() : null));
  const [status, setStatus] = useState({ state: "idle", at: loadMeta().syncedAt || 0 });
  const meta = useRef(loadMeta());
  const fromRemote = useRef(false);
  const first = useRef(true);
  const timer = useRef(null);
  const busy = useRef(false);
  const keyRef = useRef(syncKey);
  keyRef.current = syncKey;
  const stateRef = useRef(state);
  stateRef.current = state;
  const writeMeta = (m) => { meta.current = { ...meta.current, ...m }; saveMeta(meta.current); };

  const doPush = async () => {
    const key = keyRef.current;
    if (!key) return;
    setStatus(s => ({ ...s, state: "busy" }));
    try {
      const at = meta.current.localAt || Date.now();
      const r = await push(key, stateRef.current, at);
      if (r.ok) { writeMeta({ localAt: at, remoteAt: at, syncedAt: Date.now() }); setStatus({ state: "ok", at: Date.now() }); }
      else await doPull();
    } catch { setStatus(s => ({ ...s, state: "offline" })); }
  };

  const doPull = async (joining = false) => {
    const key = keyRef.current;
    if (!key || busy.current) return;
    busy.current = true;
    setStatus(s => ({ ...s, state: "busy" }));
    try {
      const r = await pull(key);
      if (!r.found) {
        if (joining) { setSyncKey(null); saveKey(null); saveMeta(null); setStatus({ state: "notfound", at: 0 }); return; }
        busy.current = false;
        await doPush();
        return;
      }
      const { localAt, remoteAt } = meta.current;
      const next = sanitize(r.payload);
      if (r.updatedAt > remoteAt && (joining || r.updatedAt > localAt) && next) {
        fromRemote.current = true;
        setState(next);
        writeMeta({ localAt: r.updatedAt, remoteAt: r.updatedAt, syncedAt: Date.now() });
        setStatus({ state: "ok", at: Date.now() });
      } else if (localAt > Math.max(remoteAt, r.updatedAt)) {
        busy.current = false;
        await doPush();
        return;
      } else {
        writeMeta({ syncedAt: Date.now() });
        setStatus({ state: "ok", at: Date.now() });
      }
    } catch { setStatus(s => ({ ...s, state: "offline" })); }
    finally { busy.current = false; }
  };

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (fromRemote.current) { fromRemote.current = false; return; }
    writeMeta({ localAt: Date.now() });
    if (!keyRef.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(doPush, 800);
  }, [state]);

  useEffect(() => {
    if (!syncKey) return;
    const tick = () => { if (document.visibilityState === "visible") doPull(); };
    tick();
    const iv = setInterval(tick, 20000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", tick); window.removeEventListener("online", tick); };
  }, [syncKey]);

  const enable = () => {
    const key = newKey();
    saveKey(key); keyRef.current = key;
    writeMeta({ localAt: meta.current.localAt || Date.now(), remoteAt: 0 });
    setSyncKey(key);
    doPush();
  };
  const join = (key) => {
    saveKey(key); keyRef.current = key;
    meta.current = { localAt: 0, remoteAt: 0, syncedAt: 0 }; saveMeta(meta.current);
    setSyncKey(key);
    doPull(true);
  };
  const disconnect = () => {
    saveKey(null); saveMeta(null);
    meta.current = { localAt: 0, remoteAt: 0, syncedAt: 0 };
    keyRef.current = null;
    setSyncKey(null);
    setStatus({ state: "idle", at: 0 });
  };
  return { syncKey, status, enable, join, disconnect };
}
