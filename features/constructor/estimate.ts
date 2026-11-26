// Примерная цена изделия из конструктора — так же, как считает
// калькулятор распила: листы по раскрою × цена плиты, распил за лист,
// кромка за метр, присадка по прайсу и пазы за метр. Точную сумму
// подтверждает калькулятор и менеджер.

import type { SiteCuttingPrices } from "@/features/cutting/site-prices";
import type { CabinetPart } from "@/features/services/cabinet-builder";
import { optimizeCutting } from "@/features/services/cut-optimizer";
import {
  hardwareHoles,
  hardwareWorkHoles,
  holesToDrillCounts,
} from "@/features/services/drilling-hardware";
import { millingMeters } from "@/features/services/part-milling";
import { priceDrilling } from "@/lib/drilling-price";

// Как в калькуляторе: пропил и обрезка кромок листа, мм.
const KERF = 4.4;
const EDGE_TRIM = 5;

export type PlateInfo = {
  pricePerSqM: number;
  sheetWidth: number;
  sheetHeight: number;
};

export type Estimate = {
  sheets: number;
  material: number;
  cutting: number;
  edgeMeters: number;
  edge: number;
  drilling: number;
  milling: number;
  total: number;
};

export function estimateParts(
  parts: CabinetPart[],
  thickness: number,
  plate: PlateInfo | null,
  prices: SiteCuttingPrices,
): Estimate | null {
  if (!plate || !(plate.pricePerSqM > 0) || parts.length === 0) return null;
  const pieces = parts.flatMap((part, index) =>
    Array.from({ length: part.quantity }, (_, copy) => ({
      id: `${index}-${copy}`,
      width: part.length,
      height: part.width,
      orientationMode: part.fixedGrain ? ("fixed" as const) : ("free" as const),
    })),
  );
  const packed = optimizeCutting(
    pieces,
    plate.sheetWidth - 2 * EDGE_TRIM,
    plate.sheetHeight - 2 * EDGE_TRIM,
    KERF,
  );
  // Деталь больше листа — считаем её отдельным листом, чтобы цена не
  // оказалась ниже настоящей.
  const sheets = packed.sheets.length + packed.unplacedIds.length;
  const sheetArea = (plate.sheetWidth * plate.sheetHeight) / 1_000_000;

  let edgeMeters = 0;
  let millingCost = 0;
  const drillRows = parts.map((part) => {
    const along = part.edgedSides.filter(
      (side) => side === "top" || side === "bottom",
    ).length;
    const across = part.edgedSides.length - along;
    edgeMeters +=
      ((along * part.length + across * part.width) * part.quantity) / 1000;
    if (part.milling) {
      const meters = millingMeters(part.length, part.width, part.milling);
      millingCost +=
        (meters.curve * prices.milling +
          meters.bevel * prices.bevel +
          meters.groove * prices.groove) *
        part.quantity;
    }
    if (!part.hardware?.length) return { quantity: part.quantity };
    return {
      quantity: part.quantity,
      drill: holesToDrillCounts(
        hardwareHoles(part.hardware, part.length, part.width, thickness),
      ),
      work: hardwareWorkHoles(
        part.hardware,
        part.length,
        part.width,
        thickness,
      ),
    };
  });
  const drilling = priceDrilling(drillRows, prices.drilling, prices).cost;
  const material = sheets * sheetArea * plate.pricePerSqM;
  const cutting = sheets * prices.sheet;
  const edge = edgeMeters * prices.edge;
  return {
    sheets,
    material,
    cutting,
    edgeMeters,
    edge,
    drilling,
    milling: millingCost,
    total: material + cutting + edge + drilling + millingCost,
  };
}

// Сумма двух заявок (корпус и фасады из разных плит).
export function addEstimates(...items: Array<Estimate | null>) {
  const list = items.filter((item): item is Estimate => Boolean(item));
  if (list.length === 0) return null;
  return list.reduce((sum, item) => ({
    sheets: sum.sheets + item.sheets,
    material: sum.material + item.material,
    cutting: sum.cutting + item.cutting,
    edgeMeters: sum.edgeMeters + item.edgeMeters,
    edge: sum.edge + item.edge,
    drilling: sum.drilling + item.drilling,
    milling: sum.milling + item.milling,
    total: sum.total + item.total,
  }));
}

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

// «14 520 сом»: округляем до 10 сом, это всё равно примерная цена.
export function formatSom(value: number) {
  return `${priceFormatter.format(Math.round(value / 10) * 10)} сом`;
}
