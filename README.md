# Timezone Sync — Найди окно

Find the perfect meeting window across timezones.

![](https://img.shields.io/badge/React-18-blue) ![](https://img.shields.io/badge/Vite-6-purple) ![](https://img.shields.io/badge/Deploy-Vercel-black)

## Features

- **Visual timeline** — see everyone's day at a glance (work, sleep, free)
- **Golden window** — finds when everyone overlaps (incl. across midnight and half-hour zones like India), shows all windows and "starts in …"
- **Per-hour availability** — click a cell to toggle an hour (gaps allowed); drag with the mouse to paint several
- **Edit / remove** — click a name to edit name, city, timezone; removal can be undone
- **Any timezone** — popular zones sorted by UTC offset, plus every IANA zone the browser knows
- **Share via link** — one click copies a URL with your setup encoded. Opening a link keeps a backup of your own setup ("Вернуть мою")
- **Auto-save** — your configuration persists in localStorage between visits
- **Zero backend** — pure static site, no server, no database, no auth needed

## Two interfaces

- `index.html` — the current interface (`src/v2/`): the answer first (best slot with everyone's local time and a
  "copy for chat" invite), a larger scrollable day grid with local hours inside the cells, a "pick time / edit hours"
  switch, a participant panel with hour presets, light and dark themes, and a "best partial" slot when no common window exists
- `v1.html` — the original single-screen timeline (`src/App.jsx`, Russian only)

Both share the logic in `src/lib` and the same saved data. After deploy: `/timezone-sync/` and `/timezone-sync/v1.html`.

## Languages

English by default, plus the 9 next most spoken languages (Ethnologue 2025, first + second language).
Menu order: English, Русский (pinned second), then by number of speakers:
中文 · हिन्दी · Español · العربية · Français · বাংলা · Português · Bahasa Indonesia.
The browser language is picked automatically (English if it isn't one of these); the switcher in the top corner remembers the choice.

- Strings: `src/v2/i18n.js` (`STRINGS`). Missing keys fall back to English. Numbers, units and weekdays come from `Intl`.
- Typography per script (`src/v2/styles.css`, "per-script typography"): Golos Text for Cyrillic, Noto Sans SC for Chinese,
  Hind / Hind Siliguri for Devanagari / Bengali, IBM Plex Sans Arabic for Arabic; only the active language's font is loaded.
- Arabic is right-to-left: the page mirrors, times and the hour grid stay left-to-right.

## Publish for everyone (GitHub Pages)

`.github/workflows/deploy.yml` tests, builds and pushes `dist/` to the `gh-pages` branch on every push to `main`
(Pages must serve that branch: **Settings → Pages → Deploy from a branch → gh-pages**). The site is at
`https://<user>.github.io/timezone-sync/`, the original interface at `/timezone-sync/v1.html`.

`npm run build:artifact` (v1) and `npm run build:artifact -- v2` build single-file pages for the Claude artifact viewer.

## Quick start (local)

```bash
npm install
npm run dev
```

Open http://localhost:5173/timezone-sync/

Tests (pure logic, no extra deps):

```bash
npm test
```

## Deploy

`vite.config.js` sets `base: '/timezone-sync/'` for GitHub Pages. For Vercel/Netlify (served from the root) change it to `'/'`.

### Deploy to Vercel

### Option A: CLI
```bash
npm i -g vercel
vercel
```

### Option B: GitHub → Vercel
1. Push this folder to a GitHub repo
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo
4. Click Deploy — done

Your app will be live at `https://your-project.vercel.app`

### Option C: Netlify
```bash
npm run build
# Upload the `dist/` folder to netlify.com/drop
```

## How sharing works

Click **🔗 Поделиться ссылкой** — it encodes your current people/timezones/work hours into the URL hash. When someone opens that link, they see your exact configuration; the hash is then removed from the address bar so a reload doesn't undo their edits. No server involved.

Format (`v2`): `#v2.name~city~tz~hours,…` — text is percent-encoded (commas/tildes in names are safe), `tz` is an index into the timezone table or an IANA name, `hours` is a 24-bit hex mask. Older link formats still open.

## Customize

- `src/lib/config.js` — `DEFAULTS` (people on first visit), `TZ_TABLE` (popular zones; **only append** — share links store the index), `FLAG_MAP`, link format
- `src/lib/time.js` — offsets, formatting, common-window search
- `src/App.jsx` — UI; colors and styling are inline

## Tech stack

- **React 18** — UI
- **Vite 6** — build
- **Zero dependencies** beyond React — no state management, no CSS framework, no router

## License

MIT

## Device sync

"Sync devices" keeps a person's phone and computer on the same setup, without accounts.

- Turning it on creates a random 128-bit key on the device and shows it as a QR code / link (`#sync.<key>`).
  Opening that link on another device (and confirming) connects it.
- Data is encrypted on the device (AES-GCM, key derived from the sync key). The server stores only
  `SHA-256(key)` as the record id plus ciphertext, so it can't read names, cities or hours. Last edit wins.
- Devices push edits ~1 s after a change and pull every 20 s while the page is visible, on focus and when back online.
- Server: `worker/` — a Cloudflare Worker with a D1 (SQLite) table, no listing endpoint, records expire
  a year after the last write. Local run: `npx wrangler d1 execute tz-sync --local --file schema.sql && npx wrangler dev`
  (inside `worker/`), then build the site with `VITE_SYNC_URL=http://127.0.0.1:8787`.
- Deploy: the GitHub workflow deploys the Worker when the repo secrets `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` exist, and builds the site with its URL. Without them the button is hidden.
