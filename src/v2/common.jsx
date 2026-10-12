/* ── pieces shared by both planners (World and Company) ── */
import { useMemo, createContext, useContext } from "react";
import { getOffset, fmtOffset } from "../lib/time.js";
import { cityFor, allTimeZones, sortedCommonTZ } from "../lib/config.js";
import { makeT } from "./i18n.js";

export const I18n = createContext({ lang: "en", t: makeT("en") });
export const useI18n = () => useContext(I18n);

/* ── timezone select ── */
export function TzSelect({ id, value, onChange, now, className = "select" }) {
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

