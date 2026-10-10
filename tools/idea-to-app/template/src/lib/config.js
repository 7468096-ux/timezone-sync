/* ── app-wide settings. Build-time values come from VITE_* env vars (set by the deploy workflow) ── */
export const APP_NAME = "__APP_NAME__";
export const APP_SLUG = "__APP_SLUG__";          // prefix for localStorage keys, Worker and database names
export const SITE_URL = "__SITE_URL__";          // where "Open on the website" points from the Claude artifact
// "Buy me a coffee" page. Empty = the button is hidden.
export const DONATE_URL = import.meta.env?.VITE_DONATE_URL || "__DONATE_URL__";
// Claude artifact build (vite --mode artifact): its URL can't be shared, so links become copyable codes
export const EMBED = import.meta.env?.MODE === "artifact";
