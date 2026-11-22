import {
  defaultSiteCuttingPrices,
  otherWorks,
  type OtherWorkKey,
  type OtherWorkPriceKey,
} from "@/features/cutting/site-prices";

// Отверстия детали по диаметрам: «8» → 12 отверстий Ø8.
export type DrillCounts = Record<string, number>;

// Отверстия под фурнитуру со своей ценой из прайса (минификс, конфирмат,
// шкант): они уже лежат в DrillCounts по диаметру, а считаются по key.
export type HardwareWorkHoles = {
  key: OtherWorkKey;
  diameter: number;
  holes: number;
};

export type DrillingPriceRow = {
  diameter: number;
  holes: number;
  price: number | null;
  cost: number;
};

export type DrillingWorkRow = {
  key: OtherWorkKey;
  label: string;
  holes: number;
  price: number;
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

const diameterKey = (diameter: number) => Math.round(diameter * 10) / 10;

// Складывает отверстия деталей (с учётом количества) и считает цену.
// Отверстия из work считаются по своей цене (workPrices), остальные — по
// диаметру.
export function priceDrilling(
  items: Array<{
    drill?: DrillCounts | null;
    quantity?: number;
    work?: HardwareWorkHoles[] | null;
  }>,
  prices: Record<number, number> = defaultSiteCuttingPrices.drilling,
  workPrices: Partial<
    Record<OtherWorkPriceKey, number>
  > = defaultSiteCuttingPrices,
) {
  const holes = new Map<number, number>();
  const work = new Map<OtherWorkKey, number>();

  for (const item of items) {
    const quantity = item.quantity ?? 1;
    if (!(quantity > 0)) continue;

    for (const [key, count] of Object.entries(item.drill ?? {})) {
      const diameter = Number(key);
      if (!(diameter > 0) || !(Number(count) > 0)) continue;
      const normalized = diameterKey(diameter);
      holes.set(
        normalized,
        (holes.get(normalized) ?? 0) + Number(count) * quantity,
      );
    }
    for (const entry of item.work ?? []) {
      if (!(entry.holes > 0)) continue;
      if (!otherWorks.some((known) => known.key === entry.key)) continue;
      const normalized = diameterKey(entry.diameter);
      const left = holes.get(normalized) ?? 0;
      // Отверстие из work должно быть и в drill — иначе его нет на детали.
      const moved = Math.min(left, entry.holes * quantity);
      if (!(moved > 0)) continue;
      holes.set(normalized, left - moved);
      work.set(entry.key, (work.get(entry.key) ?? 0) + moved);
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

  const workRows: DrillingWorkRow[] = otherWorks
    .filter((entry) => (work.get(entry.key) ?? 0) > 0)
    .map((entry) => {
      const total = Math.round(work.get(entry.key) ?? 0);
      const price = workPrices[entry.price] ?? entry.fallback;
      return {
        key: entry.key,
        label: entry.label,
        holes: total,
        price,
        cost: price * total,
      };
    })
    .filter((row) => row.holes > 0);

  return {
    rows,
    workRows,
    holes:
      rows.reduce((sum, row) => sum + row.holes, 0) +
      workRows.reduce((sum, row) => sum + row.holes, 0),
    cost:
      rows.reduce((sum, row) => sum + row.cost, 0) +
      workRows.reduce((sum, row) => sum + row.cost, 0),
    unpricedHoles: rows
      .filter((row) => row.price === null)
      .reduce((sum, row) => sum + row.holes, 0),
  };
}
