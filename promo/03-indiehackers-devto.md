# Indie Hackers и dev.to

## Indie Hackers — история (раздел Posts / группа «Building in public»)

**Title:** I built a free time-zone meeting finder with zero backend — here's what I learned

**Body:**

**The problem.** [1–2 предложения о вашей ситуации: команда/клиенты/семья в N поясах.] Every tool I tried showed
clocks side by side, but left the "so when do we actually meet?" part to me.

**What I built.** Timezone Sync (https://timezone-sync.com.co): add people, set their real working hours, and it
shows the best shared window plus a "copy for chat" line with everyone's local time. No sign-up.

**Decisions that shaped it:**
- **No accounts.** The whole setup lives in the URL hash, so "share" is just a link. When people asked for
  phone↔laptop sync, I did it with a random key and end-to-end encryption instead of logins.
- **Answer first.** The first version was a pretty timeline. Users still had to find the overlap themselves.
  v2 puts the answer — the best slot — at the top, and the grid below.
- **10 languages from day one.** [Если есть данные из GoatCounter по странам — вставить сюда; не выдумывать.]
- **Free, with a coffee button.** No paid tier for now; the hosting is a single Cloudflare Worker, so costs are tiny.

**What I'd like to learn from you:** how did you get your first users for a free tool without ads? And what would
make you use this over [World Time Buddy / your current method]?

*(Если правда, что делали с помощью Claude — это отдельная интересная история для IH: «как я сделал приложение с ИИ
за N дней», и в репозитории лежит skill `tools/idea-to-app`. Указывайте только реальные сроки и цифры.)*

---

## dev.to — техническая статья

**Title:** Sharing app state in the URL hash: a tiny format that survived three versions

**Tags:** `#javascript #webdev #react #privacy`

**Outline / text:**

1. **Why the hash.** It never reaches the server, works on static hosting, and "share" becomes "copy link".
2. **The format.** `#v2.name~city~tz~hours,…`: percent-encoded text (so commas and tildes in names are safe),
   time zone as an index into an append-only table (or a full IANA name when it's not in the table), hours as a
   24-bit hex mask — or 12 hex digits (48 half-hours) when someone has half-hour slots.
3. **Versioning.** Prefix `v2.`; old formats still decode. Rule learned the hard way: the zone table is append-only,
   because links store indexes.
4. **UX details.** Clear the hash after loading so reload doesn't undo edits; keep a backup of the visitor's own
   setup with a "Restore mine" button, so opening a colleague's link never destroys yours.
5. **When the URL isn't enough.** Multi-device sync with a random key, AES-GCM in the browser, and a Worker that only
   stores ciphertext (short version of the Habr article).
6. **Try it / read the code:** https://timezone-sync.com.co · https://github.com/7468096-ux/timezone-sync

Отдельный короткий пост для dev.to, если первый зайдёт: «Finding a meeting window across midnight and +5:30 zones»
(разбор алгоритма из `src/lib/time.js`).
