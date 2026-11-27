// Сезонное оформление витрины (сейчас только «Новый год»).
// Режим хранится в SiteSetting, переключается в админке: «Контент сайта».
//   auto — само включается 1 декабря и выключается 15 января (время Бишкека);
//   on   — включено всегда, пока не выключите;
//   off  — выключено.

export const SEASON_MODES = ["auto", "on", "off"] as const;
export type SeasonMode = (typeof SEASON_MODES)[number];

export type ActiveSeason = {
  kind: "newyear";
  greeting: string;
};

export function normalizeSeasonMode(value: unknown): SeasonMode {
  return SEASON_MODES.includes(value as SeasonMode)
    ? (value as SeasonMode)
    : "auto";
}

function bishkekDate(now: Date) {
  // Бишкек — UTC+6 круглый год, без перехода на летнее время.
  const shifted = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function isNewYearWindow(now: Date) {
  const { month, day } = bishkekDate(now);
  return month === 12 || (month === 1 && day <= 14);
}

export function newYearGreeting(now: Date) {
  const { year, month } = bishkekDate(now);
  // Ноябрь тоже «наступающий»: если включить вручную заранее.
  return month >= 11
    ? `С наступающим ${year + 1} годом!`
    : `С Новым ${year} годом!`;
}

export function resolveSeason(
  mode: SeasonMode,
  now: Date = new Date(),
): ActiveSeason | null {
  if (mode === "off") return null;
  if (mode === "auto" && !isNewYearWindow(now)) return null;
  return { kind: "newyear", greeting: newYearGreeting(now) };
}
