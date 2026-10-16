import { defaultSiteCuttingPrices } from "@/features/cutting/site-prices";

// Отверстия детали по диаметрам: «8» → 12 отверстий Ø8.
export type DrillCounts = Record<string, number>;

export type DrillingPriceRow = {
  diameter: number;
  holes: number;
  price: number | null;
  cost: number;
};

// prices — присадка из «Прайс работ»; без неё действуют цены по умолчанию.
export function drillingHolePrice(
  diameter: number,
  prices: Record<number, number> = defaultSiteCuttingPrices.drilling,
) {
  // Ø4,9 и Ø5,1 в проектах — то же сверло Ø5.
  const rounded = Math.round(diameter);
  return Math.abs(diameter - rounded) <= 0.2 ? (prices[rounded] ?? null) : null;
}

// Складывает отверстия деталей (с учётом количества) и считает цену.
export function priceDrilling(
  items: Array<{ drill?: DrillCounts | null; quantity?: number }>,
  prices: Record<number, number> = defaultSiteCuttingPrices.drilling,
) {
  const holes = new Map<number, number>();

  for (const item of items) {
    const quantity = item.quantity ?? 1;
    if (!item.drill || !(quantity > 0)) continue;

    for (const [key, count] of Object.entries(item.drill)) {
      const diameter = Number(key);
      if (!(diameter > 0) || !(Number(count) > 0)) continue;
      holes.set(
        diameter,
        (holes.get(diameter) ?? 0) + Number(count) * quantity,
      );
    }
  }

  const rows: DrillingPriceRow[] = [...holes.entries()]
    .map(([diameter, count]) => {
      const total = Math.round(count);
      const price = drillingHolePrice(diameter, prices);
      return { diameter, holes: total, price, cost: (price ?? 0) * total };
    })
    .filter((row) => row.holes > 0)
    .sort((left, right) => right.diameter - left.diameter);

  return {
    rows,
    holes: rows.reduce((sum, row) => sum + row.holes, 0),
    cost: rows.reduce((sum, row) => sum + row.cost, 0),
    unpricedHoles: rows
      .filter((row) => row.price === null)
      .reduce((sum, row) => sum + row.holes, 0),
  };
}
