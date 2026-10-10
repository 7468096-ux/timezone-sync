# Reddit

Перед каждым постом: прочитать правила сабреддита (sidebar/wiki), посмотреть, есть ли еженедельный тред для
самопиара — если есть, постить туда. Пересказать своими словами: шаблонный «ИИ-стиль» на Reddit минусуют.

---

## r/SideProject (самопиар разрешён — начать отсюда)

**Title:** I got tired of "wait, what time is that for you?" so I built a free meeting-time finder

**Body:**

My team is spread across [Berlin, Bangkok and Austin — подставьте своё], and every recurring call turned into a
thread of people doing time-zone math. Existing tools show you clocks side by side, but you still have to eyeball
the overlap yourself.

So I built **Timezone Sync**: https://timezone-sync.com.co

- Add people and set *their* working hours — not just 9–5, gaps and half-hours are fine
- It highlights the best shared window (works across midnight and for +5:30 zones like India) and tells you how
  soon it starts
- "Copy for chat" gives you one line with everyone's local time to paste into Slack
- Share the whole setup as a link — the data lives in the URL, no accounts
- Optional phone↔laptop sync, end-to-end encrypted
- 10 languages, light/dark, open source (MIT)

It's free and will stay free. I'd really like feedback: what's confusing on first open, and what's missing for
your use case?

---

## r/remotework / r/digitalnomad (сначала польза, потом ссылка)

**Title:** How we stopped losing 20 minutes every week scheduling a call across 4 time zones

**Body:**

A few things that actually helped our distributed team, in order of impact:

1. **Write down real hours, not "9 to 5".** Our designer starts at 7, one dev works 12–20. Once we listed actual
   hours, the "impossible" overlap turned out to be a 90-minute window.
2. **Rotate the pain.** If there's truly no overlap, alternate who takes the early/late slot each week instead of
   always the same person.
3. **Always post times in everyone's zone.** "Thu 16:00 Berlin / 21:00 Bangkok / 09:00 Austin" removes the
   back-and-forth completely.
4. **Async by default, sync for decisions.** The fewer meetings, the less this matters.

For #1 and #3 I ended up building a small free tool — you set each person's hours, it shows the shared window and
gives you the "copy for chat" line: https://timezone-sync.com.co (no sign-up). Happy to hear how others handle this.

*(Если правила сабреддита запрещают ссылки на свои проекты — убрать последний абзац и дать ссылку только тем,
кто спросит в комментариях.)*

---

## r/expats / группы релокантов

**Title:** Small thing that made family calls easier after moving abroad

**Body:**

After moving [страна → страна], our family is now spread over 3 time zones, and "when can we all call" became a
weekly puzzle — grandparents go to bed early, my brother works nights.

What helped: we put down when each person is actually free (not just "evenings") and found that Sunday 11:00 my time
works for everyone. I built a tiny free page for this, mostly for us — you mark each person's free hours and it
shows when everyone overlaps: https://timezone-sync.com.co. You can send the setup to relatives as a link,
no app or account.

---

## Шаблон ответа в чужих тредах («how do you schedule across time zones?»)

Отвечать только там, где это реально ответ на вопрос, и не чаще 1–2 раз в неделю.

> What worked for us: list everyone's *actual* hours (people rarely work exactly 9–5), find the overlap, and when
> you announce the time, write it in every attendee's zone so nobody does math. If there's no overlap, rotate who
> gets the inconvenient slot.
>
> Disclosure: I made a free tool for exactly this — set each person's hours and it shows the shared window:
> https://timezone-sync.com.co. But a spreadsheet with a row per person works too.

Строка «Disclosure: I made…» обязательна — скрытый самопиар на Reddit банят.
