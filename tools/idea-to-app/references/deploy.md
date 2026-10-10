# Level 2: website (GitHub + Cloudflare + own domain)

## Architecture

One Cloudflare Worker serves both the static site (`[assets]`, `run_worker_first = true`) and the API
(`/v1/*`) with a D1 (SQLite) database. Same origin → no CORS pain, sync and counter "just work".
Free tier is plenty (100k writes, 5M reads a day). On the real domain the Worker:
- redirects `http://` and `www.` to `https://<domain>` in one 301;
- adds HSTS, a strict CSP listing only hosts the page really loads (update it when you add a font
  host, analytics, an API), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`;
- sends `X-App-Version: <git sha>` on every response so deploys can wait for the new version.

## The workflow (`template/.github/workflows/deploy.yml`)

On push to main: `npm ci` → `npm test` → read Cloudflare credentials (tolerant parsing: trims
whitespace; if the token secret holds two lines, the 32-hex one is the account id) → check the zone
status of SITE_DOMAIN → `vite build --outDir dist-cf` with `VITE_SYNC_URL=/` → create the D1 database
if missing, apply `schema.sql` (idempotent), add custom-domain routes when the zone is active →
`wrangler deploy --var APP_VERSION:<sha>` → **live check**:
1. wait (up to 3 min) until the URL answers with *this* version (new versions take seconds to reach
   every location; a fresh domain needs minutes for its certificate);
2. the page has `id="root"`;
3. sync: GET unknown → 404, PUT → 200, GET returns it, older PUT → 409;
4. counter: `/v1/stats` → 200;
5. on the domain: http→https and www→bare redirects, security headers present.
Without a Cloudflare token the site goes to GitHub Pages (no sync/counter) so there's always a site.

Pin tool versions (`wrangler@4.149.0`). The step summary explains the domain state in plain words
(e.g. "set these nameservers at the registrar: …").

## What the user does once (give exactly these steps, in their language)

Things that need their identity. Everything else is yours.

**A. Cloudflare account + token (≈5 min)**
1. https://dash.cloudflare.com/sign-up → sign up, confirm the e-mail.
2. https://dash.cloudflare.com/?to=/:account/workers-and-pages → if asked, pick any `*.workers.dev`
   subdomain.
3. https://dash.cloudflare.com/profile/api-tokens → **Create Token** → "Edit Cloudflare Workers" →
   **Use template** → **+ Add more**: Account · D1 · Edit → (with a domain: Zone resources → include
   the domain; Zone · Zone · Read) → **Continue to summary** → **Create Token** → **Copy** the value
   from the top field (the long string — *not* the token's name, *not* the curl test command).
4. `https://github.com/<owner>/<repo>/settings/secrets/actions/new` → Name `CLOUDFLARE_API_TOKEN`,
   Secret = the value → **Add secret**. (Account id is optional; the token's account is used.)
5. Write "готово". Never paste the token into the chat.

If the value was lost: API Tokens → ⋯ → **Roll** → Copy → update the secret (pencil icon).

**B. Domain (optional, paid)**
1. Buy it at any registrar (suggest a free-name check first; ccTLDs like `.com.co` are fine).
2. Cloudflare → **Add a domain** → Free plan → it shows two nameservers.
3. At the registrar replace the nameservers with those two. Activation: minutes to hours.
4. You (Claude) set `SITE_DOMAIN` in the workflow and `CANONICAL_HOST`/`ALLOWED_ORIGINS` in
   `wrangler.toml`, push, and the next deploy attaches the domain automatically.

## Working from Claude Code (cloud sandbox)

- Use the GitHub MCP tools for PRs, merges, workflow runs and job logs (the `gh` CLI token may be
  invalid). Merge with the full 40-char `expectedHeadSha`.
- The sandbox may not be able to reach the live site (proxy 403). Don't fight it: the workflow's live
  check is the proof; poll the public run status
  `https://api.github.com/repos/<owner>/<repo>/actions/runs?head_sha=<sha>` from a background monitor.
- Artifact: rebuild with `npm run build:artifact` and publish the same file path → same URL.
- `pkill -f "<pattern>"` can kill your own shell if the pattern matches your command line: use a
  bracket pattern (`"[w]rangler dev"`) in a separate command.
- `wrangler dev` rewrites `Location` headers to http; test redirects by calling the Worker module
  directly in Node (see `template/tests/worker.test.js`).

## Troubleshooting the user's side

- **"Site doesn't open", `DNS_PROBE_FINISHED_NXDOMAIN`** right after a domain goes live: their
  resolver cached "no such domain". Prove the site works (public resolvers, HTTPS 200), then:
  `ipconfig /flushdns` (Windows) / `chrome://net-internals/#dns` → Clear host cache / reboot the router /
  DNS 1.1.1.1 + 8.8.8.8; quick test via mobile data.
- **"The site shows an old version"**: check `X-App-Version`, compare the live files byte-for-byte with
  a fresh build of main (a manual `diagnose.yml` workflow is worth having), check the old address
  redirects. Usual causes: they're looking at the Claude artifact (separate copy, separate data),
  browser cache, or "old" data rather than old code. Fix the real cause (Timezone Sync: added "Open
  on the website ↗" to carry artifact data over).
- **Favicon didn't change**: browsers cache favicons hard — Ctrl+F5 or a new tab.
- **Deploy fails at the live check with 404 on the API** right after deploy: version not propagated —
  the version wait handles it; don't "fix" with sleeps.
