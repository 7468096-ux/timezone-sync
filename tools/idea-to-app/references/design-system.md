# Design system

Calm, dark-first, one warm accent, monospace for numbers. Everything is tokens in
`template/src/styles.css`; change the look by editing tokens, not components.

## Tokens

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | #0c0c0f | #f3f2ee | page |
| `--surface` / `--surface-2` | #15151a / #1d1d24 | #fff / #f0eee8 | cards, sheets / hover, toast |
| `--line` / `--line-strong` | white 9% / 18% | ink 10% / 22% | hairlines / control borders |
| `--fg` `--muted` `--faint` | #ece8e1 #a39e96 #6c675f | #1d1b17 #5f5a52 #8f897f | text levels |
| `--accent` | #f0c050 (default) | same | the one brand colour: primary button, "on" switch, highlights, favicon |
| `--accent-ink` | = accent | accent mixed 55% with black | accent-coloured *text* (must stay readable on white) |
| `--accent-soft` / `--accent-line` | accent 20% / 45% | 28% / darker | highlighted areas / hover borders |
| `--ok` `--bad` | #5cc08d #e5735f | #217a4b #b8432f | success / error |

Fonts: DM Sans (UI), JetBrains Mono (times, numbers, codes). Other scripts: see `i18n.md`.
Theme follows the system (`prefers-color-scheme`); both themes must be checked.

## Layout rules

- **Answer first.** The top card shows the result of the main question in big type (Timezone Sync:
  the best meeting time, "happening now / in 3 h", who is free ✓/✕, "Copy for chat"). Details and
  editing tools below. If there's no perfect answer, show the best partial one and who/what blocks it
  instead of a red error.
- Header: small mono eyebrow with the product name (always Latin, `lang="en" dir="ltr"`), a light
  30 px headline (`font-weight: 300`), language switcher top-right.
- Max width ~880–1120 px, 24 px padding (16 px on phones), 18 px gaps between blocks.
- **No layout jumps.** Rows that appear on interaction must reserve their space (Timezone Sync: the
  chips row is always rendered, so the grid didn't move under the cursor while dragging).
- Wide content (grids, tables) scrolls inside its own container with sticky first column; the page
  itself never scrolls sideways at 390 px.
- Touch targets ≥ 32 px; inputs and buttons inherit the font.
- Quiet things must be quiet: footer counter 12 px `--faint`; "coffee" is a dashed pill that lights up
  on hover. Background markings (night hours, disabled areas) are faint hatching, never a grey block
  that reads as "available" or "selected".

## Components (all in the template)

- `.btn` (+ `.primary`, `.ghost`, `.small`, `.danger`, `.done` for "✓ Copied" feedback), `.icon-btn`.
- `.seg` — segmented control for modes ("Pick a time | Edit hours").
- `Switch` — minimalist pill switch: white knob, track turns accent when on, label to the right,
  mirrored in RTL. Use for on/off preferences; remember the choice in localStorage.
- `.notice` / `.notice.bad` — inline messages with actions ("Loaded from a link · Restore mine · Got it").
- `.sheet` in `.backdrop` — dialogs; bottom sheet on phones; Esc and backdrop click close.
- `.toast` — bottom-centre, 6 s, with Undo.
- Language switcher — globe + native name pill; menu lists native name + English name + ✓.
- `.foot` — counter left, coffee right.

## Favicon

A flat circle in the accent colour (inline SVG data URI in `index.html`, `fill='%23<hex>'`).
No gradients, no emoji. Change it together with `--accent`.

## Money

Store integer minor units (cents/kopeks), never floats; splits must add up exactly (distribute the
leftover cents deterministically). Accept typed amounts with comma or dot, spaces and symbols.
Show with `Intl.NumberFormat(locale + "-u-nu-latn", { style: "currency", currency })` in results *and*
inputs (don't show "700.00" in an input next to "3 795,00 ₽" in the result). Amounts are LTR islands
inside RTL text. Let the user pick the currency; default from the language.

## Copy

Short, human, second person. Buttons are verbs ("Copy for chat", "Share link"). Times show minutes
when they aren't whole ("16:30"). Every state has words: empty, loading, offline, damaged link.
