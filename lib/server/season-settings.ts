import "server-only";

import { getDb, hasDatabaseUrl } from "@/lib/db";
import { normalizeSeasonMode, type SeasonMode } from "@/lib/season";

const KEY = "storefront:season:v1";

export async function getSeasonMode(): Promise<SeasonMode> {
  // Для скриншотов и проверки без базы: ARTISAN_SEASON=on|off|auto.
  const forced = process.env.ARTISAN_SEASON;
  if (forced) return normalizeSeasonMode(forced);
  if (!hasDatabaseUrl()) return "auto";

  try {
    const setting = await getDb().siteSetting.findUnique({
      where: { key: KEY },
    });
    return normalizeSeasonMode(
      (setting?.value as { mode?: unknown } | null)?.mode,
    );
  } catch {
    // Оформление не должно ронять витрину.
    return "auto";
  }
}

export async function saveSeasonMode(mode: SeasonMode) {
  const value = { mode: normalizeSeasonMode(mode) };
  await getDb().siteSetting.upsert({
    where: { key: KEY },
    create: {
      key: KEY,
      value,
      description: "Новогоднее оформление витрины: auto / on / off",
    },
    update: { value },
  });
  return value.mode;
}
