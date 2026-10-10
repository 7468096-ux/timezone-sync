# Sharing, codes, sync, moving

## Share links and codes

- Link: `SITE/#s.<base64url(JSON)>`; the code is the same `s.…` string (for places where links don't
  work: the Claude artifact, messengers that mangle URLs). Template: `src/lib/share.js`.
- On open: read the hash and **remove it immediately** (`history.replaceState`) — otherwise a reload
  re-applies the link over the user's later edits.
- A link **never silently replaces** the user's own data: save a backup, show "Loaded from a link ·
  Restore mine · Got it".
- A damaged/cut link shows "This link is damaged — showing your saved data" and changes nothing.
- A link pasted into an already-open tab works (`hashchange`).
- Everything decoded passes `sanitizeState`: unknown fields dropped, sizes capped, invalid entries
  skipped. Normalize legacy values (Timezone Sync: `Asia/Calcutta` → `Asia/Kolkata`).
- **Formats are forever.** Version them (`v2.` prefix in Timezone Sync), keep decoding every older
  format, and when a format stores indexes into a table, that table is append-only. For larger states
  design a compact format (Timezone Sync: people joined by ",", fields by "~", percent-escaped text,
  hours as a hex bitmask — 2–3× shorter than JSON) and test the roundtrip with commas, tildes, emoji,
  Cyrillic, CJK in names.
- Clipboard can be blocked (http, iframes, old browsers): fall back to a selectable field
  "Copy it manually:".
- "Copy for chat": a ready human message (what, when, each person's local time), not just a link.

## Device sync without accounts (Timezone Sync "option 2")

Why: people want phone + computer in sync but won't create accounts. Design:

- A random 128-bit key (22 url-safe chars) is the whole identity. Pairing: the first device shows a
  QR code + link `SITE/#sync.<key>`; the second scans it and confirms "Connect this device?" (its own
  data will be replaced). A "I already have a code" field for manual entry.
- The server never sees the key: id = SHA-256("<slug>:id:" + key), payload = AES-GCM with key
  SHA-256("<slug>:enc:" + key), random 12-byte IV. Tests assert the ciphertext doesn't contain the
  plaintext and a wrong key fails.
- API (`worker/src/index.js`): `GET /v1/s/:id`, `PUT /v1/s/:id {iv,data,updatedAt}`. **Last write
  wins**: the server only replaces an older copy and answers 409 with the stored time otherwise; the
  client then pulls. 64 KB limit, `updatedAt` sanity check, daily cron deletes copies untouched for a
  year. No listing endpoint.
- Client (`src/lib/useDeviceSync.js`): push 800 ms after an edit; pull on start, every 20 s while the
  tab is visible, on focus and when back online; status "Synced at 14:05 / Syncing… / Offline".
- Per-device settings stay per device (Timezone Sync: "my time zone" — a phone abroad shows local time).
- Disabled in the artifact build (no network there) — the artifact gets codes instead.

## User counter

`POST /v1/hello {id}` once per browser (random id in localStorage, no IP, no cookies) → total;
later visits `GET /v1/stats` (cached 5 min). Shown tiny in the footer with a tooltip explaining it's
anonymous. Hidden when unknown.

## Moving to a new address (e.g. github.io → own domain)

localStorage is per origin, so data doesn't follow a domain change. The old address serves a tiny
redirect page that reads its localStorage and forwards to `NEW/#migrate.<base64url JSON>` (state,
settings, language, sync key). The new site applies it **only if it has nothing saved yet**, then
clears the hash. Keep the old address redirecting forever (links live in chats). Timezone Sync:
`deploy/moved.html` + `consumeMigration()` in `src/lib/storage.js`.

## Artifact ↔ website handoff

The Claude artifact has its own storage. Give it an "Open on the website ↗" link that carries the
current state as a share link (`SITE_URL/#s.…`), so moving to the site is one click.
