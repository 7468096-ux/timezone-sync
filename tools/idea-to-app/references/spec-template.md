# Spec template ("improved prompt")

Show this to the user in their language before building — 10–20 lines, not an essay. Fill every
field; where the user said nothing, choose a default and mark it "(по умолчанию)" / "(default)".

```
**<App name>** — <one sentence: who it helps and with what>.

Главный вопрос, на который отвечает экран: <e.g. "когда всем удобно созвониться?">
Ответ показывается первым: <the result card: what number/time/verdict, big>

Данные: <entities and fields; what is saved; limits (e.g. up to 30 people)>
Действия: <add / edit / remove (with undo) / pick / share / …>
Точность и крайние случаи: <the domain's tricky parts — e.g. half-hour time zones, midnight wrap,
  DST, rounding money to cents, empty state, 1 item, max items, very long names, RTL text>

Интерфейс: ответ сверху → детали → действия; мобильная версия 390 px; светлая и тёмная тема.
Языки: 10 самых распространённых, английский по умолчанию, <owner language> вторым.
Обмен: ссылка и код; синхронизация телефона и компьютера без аккаунта (по QR).
Подвал: тихий счётчик пользователей, кнопка «на кофе» (https://ko-fi.com/aleks_lou, если не сказано иное).
Публикация: <artifact in Claude | website at <domain> with HTTPS and auto-deploy>.
Только на сайте (в артефакте недоступно): синхронизация устройств, счётчик — появятся с уровнем 2.

Готово, когда: тесты проходят; в браузере проверены телефон/компьютер, обе темы, арабский (RTL);
главный сценарий работает; ошибок в консоли нет.
```

## Finding the "tricky parts"

Spend a minute listing what can go wrong in this domain before writing code; these became the most
valuable fixes in Timezone Sync. Ask yourself:

- What units/granularity does reality use? (half-hours, cents, minutes, kg vs lb)
- What wraps around? (midnight, week, year, month lengths, DST)
- What happens with zero, one, the maximum, duplicates, very long text, emoji, RTL names?
- What if two things are true "most of the time" but not together? (Timezone Sync: "3 of 4 free" was
  false because different people were free in different hours — require the same set throughout.)
- What comes from outside and can be malformed? (links, pasted codes, old saved data, other devices)
