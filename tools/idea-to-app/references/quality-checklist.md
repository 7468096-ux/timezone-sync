# Quality checklist

Run through the relevant block at the end of each phase, and the whole "pre-ship gate" before every
push or publish. These items come from real defects found in Timezone Sync.

## Logic
- [ ] Pure functions in `src/core/`, unit tests for each rule and edge case (aim: every bug found gets a test).
- [ ] True granularity of the domain (half-hours, cents…), not rounding hidden by rendering.
- [ ] Wrap-arounds merged (a range across midnight is one range, not two pieces).
- [ ] A result must hold *throughout* (a window counts only if it fits fully into everyone's hours;
      "N of M available" only if the same N for the whole span).
- [ ] Display never shows impossible values ("24:05" → "00:05"; minutes shown when non-zero).
- [ ] Time "now" is one reference for the whole screen (one now-line, not per-row drift).

## Data safety
- [ ] Every external input sanitized (links, codes, localStorage, sync payloads, old saved shapes).
- [ ] A bad value can't brick the app permanently (it must not be saved and re-crash on every load).
- [ ] Separators in user text (`,` `~` `#` `.`) can't break formats; roundtrip tests with emoji/Cyrillic/CJK.
- [ ] Links/codes: hash cleared after reading; backup + "restore mine"; damaged → notice; old formats decode.
- [ ] localStorage access wrapped in try/catch (private mode, quota).
- [ ] Saved preferences only when the user explicitly chose them (auto-detected values stay automatic,
      e.g. time zone while travelling).

## Interaction
- [ ] Clicks mean one thing per mode; modes are visible (segmented control).
- [ ] Drag-to-paint/select uses pointer events; a global `pointerup`/`pointercancel` ends it (no
      "stuck brush" when the mouse is released outside the window or iframe).
- [ ] Touch: tap works, scrolling doesn't toggle things, targets ≥ 32 px.
- [ ] Destructive actions have Undo (toast, ~6 s) instead of confirm dialogs; the delete control is
      visible on phones (no hover-only buttons).
- [ ] Everything editable can be edited in place (no "delete and re-add").
- [ ] Layout doesn't shift during interaction (reserve space for rows that appear).
- [ ] Keyboard: Esc closes sheets/menus, focus visible, Enter submits.
- [ ] Clipboard failure → manual-copy field.

## Look
- [ ] Answer-first card; partial answer instead of an error when nothing is perfect.
- [ ] Contrast: hints and legends readable (not grey-on-black); background markings faint.
- [ ] Dark and light both checked; accent text readable on white (`--accent-ink`).
- [ ] 390 px: no horizontal page scroll; wide content scrolls in its own box with sticky labels;
      the selected item scrolls into view.
- [ ] Favicon = flat accent circle; title = "Product — headline in current language".

## Languages
- [ ] No hard-coded strings; every key in all 10 languages.
- [ ] Arabic: RTL mirrored, times/codes LTR, no letter-spacing, fits at 390 px.
- [ ] Hindi/Bengali/Chinese fonts load and line-height is comfortable.
- [ ] Latin digits everywhere; Intl for units/dates.

## Delivery
- [ ] Artifact build works and has "Open on the website ↗" (when a site exists).
- [ ] Footer: counter (only when known) + coffee link (target=_blank, rel=noopener).
- [ ] Deploy workflow green including the live check; the user-facing URL serves the new version.

## Pre-ship gate (every push/publish)
1. `npm test` — all pass.
2. `npm run build` — no warnings that matter.
3. Headless browser: desktop 1100 px + phone 390 px; dark + light; Arabic; main flow; broken link;
   **0 console errors**; look at the screenshots.
4. Re-read the diff as a hostile reviewer: what breaks old links, old saved data, the other UI version,
   RTL, the artifact build?
5. Only then push / merge / publish. Then confirm the deploy run and live check passed.
