// Короткая дата для списков: «Сегодня, 12:40», «Вчера, 18:20», «23 ноя, 10:14».
const OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const time = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Bishkek",
  hour: "2-digit",
  minute: "2-digit",
});
const day = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Bishkek",
  day: "numeric",
  month: "short",
});
const dayYear = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Bishkek",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function localDay(date: Date) {
  return Math.floor((date.getTime() + OFFSET_MS) / DAY_MS);
}

export function formatListDate(date: Date, now = new Date()) {
  const diff = localDay(now) - localDay(date);
  const clock = time.format(date);
  if (diff === 0) return `Сегодня, ${clock}`;
  if (diff === 1) return `Вчера, ${clock}`;
  const sameYear =
    new Date(date.getTime() + OFFSET_MS).getUTCFullYear() ===
    new Date(now.getTime() + OFFSET_MS).getUTCFullYear();
  return `${(sameYear ? day : dayYear).format(date).replace(".", "")}, ${clock}`;
}
