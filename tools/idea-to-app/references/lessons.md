# Lessons from building Timezone Sync

The full journey, condensed: what the user asked, what went wrong, and the rule it produced.
Read once before starting; it's why the skill works the way it does.

| # | User asked / reported | What happened | Rule |
|---|---|---|---|
| 1 | "Review the logic, find flaws, fix, structure the result" | Found: half-hour zones shown wrong (+5:30 as whole hours), windows across midnight split, windows counted though someone was free only part of them, "24:05", a comma in a name broke share links, one bad time zone in a link broke the app *forever* (saved), link stayed in the URL so reload wiped edits, a shared link silently overwrote the user's data, no edit (only delete+add), no undo, delete invisible on phones, grey-on-black hints | The quality checklist. Report as a structured table: problem · what it was · fix. |
| 2 | "Let me try it here in Claude" | Built a single-file artifact; found the "stuck brush" (mouse released outside the iframe kept painting) | Always ship an artifact build; global pointerup. In the artifact, links become copyable codes. |
| 3 | "A more convenient version, don't overwrite the old one" | v2 next to v1, sharing `src/lib`. Answer-first card, two modes, editor sheet, light/dark. Found: grid jumped under the cursor (card grew); "3 of 4 free" was false (different people each hour) | Keep old versions on redesign. Reserve layout space. Partial answers must hold throughout. |
| 4 | "Make it public, English default, 10 top languages, compact switcher, nice typography per language" | 10 languages, per-script fonts, RTL, auto-deploy to GitHub Pages | `i18n.md`. |
| 5 | "Russian second. Give me only confirm buttons; do what you can yourself" | Did everything possible; gave only identity steps | **Do it yourself.** User steps = numbered clicks + direct links + "write «готово»". |
| 6 | "Phone and computer for one person — simplest vs right?" → chose "no accounts, key + QR" | E2E-encrypted sync on a Cloudflare Worker + D1 | Offer 2–3 options with a recommendation; build the chosen one fully. |
| 7 | Secrets setup | Account id empty → made optional; token secret had extra lines → tolerant parsing; user pasted the token *name* → explained exactly which field to copy | Expect messy secrets; parse tolerantly; describe the exact UI field ("top field with Copy", not the curl block). |
| 8 | "Move to my own domain timezone-sync.com.co" | Worker serves site + API on the domain; old github.io redirects and **carries data** (`#migrate.`) | Never strand user data when the address changes. |
| 9 | "The site doesn't open" (NXDOMAIN) | Their DNS cache, not the site. Proved with public resolvers, gave flush steps | Diagnose before changing code; prove where the fault is. |
| 10 | "Wait wait — the site isn't the latest version! Check very carefully" | Byte-compared live vs build: identical. The "old version" was the artifact's *data* | Prove what's live first. Then fix the real cause: "Open on the website ↗" handoff. |
| 11 | "Counter, coffee button with local slang, secure version, diagnostics" | Anonymous counter, 10 coffee phrases, HTTPS-only + headers, diagnose workflow, live check of all of it | Footer pattern; security headers by default. |
| 12 | Deploy check failed with 404 | New Worker version not yet everywhere | `X-App-Version` + wait for the exact version. |
| 13 | "Column 16 should light up — everyone is free" (India +5:30) | First fix: drew half-cells. **Rejected**: "No, wrong — split India's hours into halves, select each separately; light up a half if everyone's free" | Fix the model, not the picture. Ask what interaction the user expects when a fix changes behaviour. Half-hour slots became the source of truth. |
| 14 | "Grey cells 0–6 confuse me" | Night became faint hatching | Background marks must not look like data. |
| 15 | "Where's the donate icon?" → "Put the link in yourself! Don't suggest I do it!" | Button was hidden because the URL was an env var to "configure" | Never leave the user a config step. Put real values in code defaults. |
| 16 | "A toggle to split all cells in half, nice switch, minimalist" + reference image | Pill switch in the app's accent, remembered | Follow reference images; minimal; remember preferences. |
| 17 | "Orange circle favicon" → "That's not a circle, it's a ball!" → "use the app's yellow accent" | Gradient read as 3D; flat + accent accepted | Literal and flat; brand items use the app accent. |
| 18 | "Improve the prompt before executing" | Restated the request as a spec first | Step 0 of the skill. |

## What the user values (keep doing)

- Finding *and* fixing mismatches even when the path went wrong ("Даже когда путь ушёл не туда, ты
  нашёл ошибку… и всё исправил").
- Structured results, plain language, links that open.
- Small delightful details: local slang, per-script typography, "Copy for chat", Undo.
