# __APP_NAME__

__APP_TAGLINE__

Made with the `idea-to-app` skill (the Timezone Sync recipe).

## Commands

```bash
npm install
npm run dev              # http://localhost:5173
npm test                 # model, share codes, sync crypto, Worker API
npm run build            # dist/
npm run build:artifact   # dist-artifact/__APP_SLUG__.html — one file for a Claude artifact
```

## Structure

| Path | What |
|---|---|
| `src/core/` | domain logic, pure functions (tested) |
| `src/App.jsx` | UI: header, language menu, notices, main content, share/sync toolbar, footer |
| `src/i18n.js` | all strings in 10 languages, fonts per script, RTL, formatting |
| `src/styles.css` | design tokens (light/dark) and components |
| `src/lib/` | storage, share links/codes, device sync (E2E), counter, config |
| `worker/` | Cloudflare Worker: site + API (`/v1/s/:id`, `/v1/hello`, `/v1/stats`) + HTTPS/security headers; D1 schema |
| `.github/workflows/deploy.yml` | test → deploy → live check (or GitHub Pages without a Cloudflare token) |

## Publishing

Add the `CLOUDFLARE_API_TOKEN` secret (template "Edit Cloudflare Workers" + Account · D1 · Edit) and
push to `main`. With the domain __DOMAIN__ added to the same Cloudflare account, the site is served at
https://__DOMAIN__; otherwise at its `workers.dev` address.
