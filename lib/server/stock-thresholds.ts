import "server-only";

import { CategoryKind } from "@/generated/prisma";
import { getDb, hasDatabaseUrl } from "@/lib/db";

// Остаток, при котором товар попадает в список «Товары заканчиваются».
// Плиты считают листами, фурнитуру штуками, поэтому пороги разные.
const KEY = "stock:low-thresholds:v1";

export type StockThresholds = Record<CategoryKind, number>;

export const DEFAULT_STOCK_THRESHOLDS: StockThresholds = {
  [CategoryKind.PLATE]: 5,
  [CategoryKind.FITTINGS]: 5,
  [CategoryKind.OTHER]: 5,
};

export const MAX_STOCK_THRESHOLD = 100_000;

function clean(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  return Number.isInteger(parsed) &&
    parsed >= 0 &&
    parsed <= MAX_STOCK_THRESHOLD
    ? parsed
    : fallback;
}

export function normalizeStockThresholds(value: unknown): StockThresholds {
  const stored = (value ?? {}) as Partial<Record<CategoryKind, unknown>>;

  return {
    [CategoryKind.PLATE]: clean(
      stored[CategoryKind.PLATE],
      DEFAULT_STOCK_THRESHOLDS.PLATE,
    ),
    [CategoryKind.FITTINGS]: clean(
      stored[CategoryKind.FITTINGS],
      DEFAULT_STOCK_THRESHOLDS.FITTINGS,
    ),
    [CategoryKind.OTHER]: clean(
      stored[CategoryKind.OTHER],
      DEFAULT_STOCK_THRESHOLDS.OTHER,
    ),
  };
}

export async function getStockThresholds(): Promise<StockThresholds> {
  if (!hasDatabaseUrl()) {
    return DEFAULT_STOCK_THRESHOLDS;
  }

  const setting = await getDb().siteSetting.findUnique({ where: { key: KEY } });

  return normalizeStockThresholds(setting?.value);
}

export async function saveStockThresholds(thresholds: StockThresholds) {
  const value = normalizeStockThresholds(thresholds);

  await getDb().siteSetting.upsert({
    where: { key: KEY },
    create: {
      key: KEY,
      value,
      description: "Пороги остатка для списка «Товары заканчиваются»",
    },
    update: { value },
  });

  return value;
}
