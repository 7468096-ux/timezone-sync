# Timezone Sync — Найди окно

Find the perfect meeting window across timezones.

![](https://img.shields.io/badge/React-18-blue) ![](https://img.shields.io/badge/Vite-6-purple) ![](https://img.shields.io/badge/Deploy-Vercel-black)

## Features

- **Visual timeline** — see everyone's day at a glance (work, sleep, free)
- **Golden window** — automatically finds when everyone overlaps
- **Drag to adjust** — drag the edges of work-hour bars to change schedules in real time
- **Share via link** — one click generates a URL with your setup encoded. Send to anyone
- **Auto-save** — your configuration persists in localStorage between visits
- **Zero backend** — pure static site, no server, no database, no auth needed

## Quick start (local)

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deploy to Vercel (2 minutes)

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

Click **🔗 Поделиться ссылкой** — it encodes your current people/timezones/work hours into the URL hash (base64). When someone opens that link, they see your exact configuration. No server involved.

Example: `https://timesync.vercel.app/#eyJuIjoi0KLRiyIsImMi...`

## Customize

Edit `src/App.jsx`:
- `DEFAULTS` array — change the default people shown on first visit
- `COMMON_TZ` array — add/remove timezone options in the dropdown  
- `FLAG_MAP` — map timezone IDs to emoji flags
- Colors and styling — all inline, easy to tweak

## Tech stack

- **React 18** — UI
- **Vite 6** — build
- **Zero dependencies** beyond React — no state management, no CSS framework, no router

## License

MIT
