---
name: idea-to-app
description: Turns a one-line app idea into a polished, production-grade web app — the process proven on Timezone Sync. Use whenever the user describes an app/tool/site idea and wants it built ("сделай приложение…", "хочу тул для…", "build me an app that…"), or asks to take an existing small app to the same level. Delivers a tested React app with answer-first UI, light/dark themes, mobile layout, 10 languages with RTL and per-script fonts, share links/codes, device sync without accounts, a quiet user counter and a "coffee" button; as a Claude artifact anywhere, and as a public HTTPS website on its own domain with auto-deploy and live checks when GitHub is available.
---

# Idea → App

You turn a short idea into an app the user is proud to share. The bar is Timezone Sync
(https://timezone-sync.com.co): correct logic with tests, an interface that answers the main question
first, works on a phone, in 10 languages, and ships itself.

The user should only have to *describe the idea and press confirm buttons*. Everything you can do
yourself, you do.

## Step 0 — improve the prompt, then go

Before building, rewrite the user's idea as a short spec (template: `references/spec-template.md`)
and show it in the user's language as the first lines of your reply. Fill gaps with sensible
defaults and state them; don't wait for approval unless a decision is genuinely theirs (brand name,
paid domain, anything that costs money or is public). Then start immediately.

## Pick the delivery level

| Situation | Deliver |
|---|---|
| Chat with code execution (claude.ai, any sandbox with Node) | **Level 1 — artifact.** Scaffold from `template/`, build the single-file page, publish it as an artifact. |
| Chat without Node | Level 1 by hand: one self-contained HTML file following `references/design-system.md` and `references/i18n.md`. |
| Claude Code with a GitHub repo | **Level 2 — website** (includes Level 1). Repo + CI + Cloudflare + domain: `references/deploy.md`. |

Always offer Level 2 at the end of Level 1 in one line.

## The build, in order

Work in this order; each phase has a short checklist in `references/quality-checklist.md`.

1. **Scaffold.** `node scripts/new-app.mjs --out <dir> --name "<Name>" [--domain d] [--donate url] [--accent hex]`,
   then `npm install && npm test && npm run build`. The template already contains:
   language switcher + 10 languages, RTL, per-script fonts, light/dark tokens, share link + code
   (with damaged-link notice and "restore mine"), Undo toast, device sync (E2E-encrypted, QR pairing),
   anonymous user counter, donate button, Claude-artifact build with "Open on the website ↗",
   Cloudflare Worker (site + API + HTTPS/security headers) with D1, deploy workflow with live check,
   tests for model/share/sync/worker. Replace the demo list (`src/core/model.js`, the DEMO block in
   `src/App.jsx`, demo strings in `src/i18n.js`) with the real app.
2. **Model first, with tests.** Pure functions in `src/core/`. Model the domain at its *true*
   granularity (Timezone Sync needed half-hour slots, not hours with drawing tricks). Every input from
   links, storage or sync goes through `sanitizeState` — bad data is dropped, never crashes, never saved.
3. **Interface.** Answer first (the result card on top, details below). Two modes if a click could mean
   two things. Undo instead of "are you sure". Pointer drag with a global `pointerup` stop. Layout never
   jumps while interacting. Phone width 390 px with no horizontal page scroll. First visit shows example
   data, in the visitor's language, that demonstrates success (never an error screen).
4. **Languages.** All strings in `src/i18n.js`, in all 10 languages; owner's language pinned second.
   See `references/i18n.md` (fonts per script, RTL, Latin digits, Intl formatting, local "coffee" slang).
5. **Sharing & sync.** Links and codes per `references/sharing-sync.md`. Formats are forever: only
   append, keep decoding old ones.
6. **Verify like a user.** Tests, build, then drive the real page in a headless browser: desktop + 390 px,
   dark + light, Arabic (RTL), the main flows, a broken link, console errors = 0. Look at the
   screenshots yourself before claiming anything. Re-read your diff adversarially.
7. **Ship.** Level 1: `npm run build:artifact`, publish `dist-artifact/<slug>.html`; republish the same
   path to keep the URL. Level 2: branch → PR → merge → watch the Deploy run until the live check passes.
8. **Report** (format below).

## Working rules (learned the hard way — see `references/lessons.md`)

- **Do it yourself.** Never hand the user a config step you can do (set the donate URL, write the
  code, merge, deploy, publish). The user said it plainly: "Сам впиши! Не предлагай мне такое!"
  Only things requiring their identity (sign-ups, payments, secrets) go to them — as numbered,
  click-by-click steps with direct links, ending in "напиши «готово»".
- **Never ask for secrets in chat.** They go to GitHub → Settings → Secrets; say so.
- **Reply in the user's language**, plain words, no jargon without a one-line gloss ("PR — запрос на
  слияние изменений").
- **When the user reports a bug, find the root cause and check you understood the intent.** A fix that
  only changes the drawing while the model stays wrong will be rejected. Reproduce first, prove after.
- **When the user says "the site shows an old version"**, prove what is live (version header, byte
  comparison with a fresh build) before changing anything; the cause is often elsewhere (cache, DNS,
  a different copy like the artifact, data vs code).
- **Visual requests are literal and minimal.** "Orange circle" means a flat circle, not a glossy ball.
  Follow reference images closely, use the app's own accent, prefer the quieter option.
- **Keep the old version** when asked for a redesign: build the new one next to it.
- **One validated push beats three speculative ones.** Run tests and build before every push.
- Praise or impatience doesn't change the bar: verify every time.

## Report format

In the user's language, structured, short:

1. One line: what is ready + link(s) (artifact URL, website URL).
2. What the user will see / how to use it (bullets, concrete).
3. What was checked (tests count, browsers/widths/languages, live check).
4. What was found and fixed along the way (if anything).
5. Only if needed: steps for the user, click-by-click. Otherwise nothing.
6. One-line offer of the next level or the obvious next improvement.

## Files

- `template/` — the working starter app (copied by `scripts/new-app.mjs`).
- `references/spec-template.md` — the "improved prompt" spec.
- `references/design-system.md` — tokens, components, layout rules, favicon.
- `references/i18n.md` — the 10 languages, fonts, RTL, formatting, coffee phrases.
- `references/sharing-sync.md` — links, codes, sync protocol, moving between domains.
- `references/deploy.md` — GitHub + Cloudflare + domain, what the user does once, troubleshooting.
- `references/quality-checklist.md` — per-phase checklist and the pre-ship gate.
- `references/lessons.md` — the Timezone Sync timeline: every mistake and the rule it produced.
