// Счёт за работы по заявке на распил: распил листов, кромление, присадка
// и фрезеровка отдельными строками. Сумма строк — «Итог» заявки.

import {
  calculateCuttingLaborTotal,
  type CuttingLaborPrice,
} from "@/features/cutting/labor-price";
import {
  defaultSiteCuttingPrices,
  isValidSitePrice,
  otherWorks,
  type OtherWorkKey,
  type OtherWorkPriceKey,
} from "@/features/cutting/site-prices";

// Работы сверх распила и кромки: отверстия по диаметрам и метры фрезеровки.
export type CuttingExtras = {
  drilling: Record<string, number>;
  curveMeters: number;
  bevelMeters: number;
  // Пазы в пласти; в старых заявках поля нет.
  grooveMeters?: number;
  // Откуда взяты данные: калькулятор, проект Базиса или менеджер.
  source: "calculator" | "bazis" | "manager";
  // Другие работы со своими ценами (ЛДСП — cuttingSheetCount заявки):
  // ХДФ, HPL, столешница, утолщёнка, Gola. В старых заявках полей нет.
} & Partial<Record<OtherWorkKey, number>>;

// Цены присадки и фрезеровки: из «Прайс работ» (цены сайта).
export type CuttingExtrasPrice = {
  drilling: Record<number, number>;
  milling: number;
  bevel: number;
  groove: number;
} & Record<OtherWorkPriceKey, number>;

// Поля других работ: листы ХДФ, метры, отверстия под фурнитуру.
const allWorkKeys = otherWorks.map((work) => work.key);
// Материалы (ХДФ, HPL, столешница…) — без отверстий под фурнитуру.
export const materialWorkKeys = otherWorks
  .filter((work) => work.group === "material")
  .map((work) => work.key);
// Отверстия под фурнитуру по своей цене: минификс, конфирмат, шкант…
export const hardwareWorkKeys = otherWorks
  .filter((work) => work.group === "hardware")
  .map((work) => work.key);
type MaterialWorkKey = OtherWorkKey;

function validSheets(value: unknown) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 10000
    ? value
    : null;
}

// Листы и штуки — целые числа, метры — с сотыми.
function isSheetKey(key: MaterialWorkKey) {
  return otherWorks.some((work) => work.key === key && work.unit !== "m");
}

function hasHardwareWork(extras: CuttingExtras | null | undefined) {
  return hardwareWorkKeys.some((key) => (extras?.[key] ?? 0) > 0);
}

export function hasMaterialWork(extras: CuttingExtras | null | undefined) {
  return materialWorkKeys.some((key) => (extras?.[key] ?? 0) > 0);
}

// Присадка и фрезеровка без учёта ХДФ, HPL и столешницы.
export function hasMachiningExtras(extras: CuttingExtras | null | undefined) {
  return Boolean(
    extras &&
    (Object.keys(extras.drilling).length > 0 ||
      extras.curveMeters > 0 ||
      extras.bevelMeters > 0 ||
      (extras.grooveMeters ?? 0) > 0 ||
      hasHardwareWork(extras)),
  );
}

// Присадка из проекта Базиса + материалы, которые менеджер ввёл руками.
export function mergeMaterialWork(
  base: CuttingExtras | null | undefined,
  from: CuttingExtras | null | undefined,
): CuttingExtras | null {
  if (!hasMaterialWork(from)) return base ?? null;
  const merged: CuttingExtras = base
    ? { ...base, drilling: { ...base.drilling } }
    : { drilling: {}, curveMeters: 0, bevelMeters: 0, source: "manager" };
  for (const key of materialWorkKeys) {
    const amount = from?.[key] ?? 0;
    if (amount > 0) merged[key] = amount;
  }
  return merged;
}

export type CuttingQuotePrice = CuttingLaborPrice & CuttingExtrasPrice;

export type CuttingQuoteLine = {
  key: string;
  label: string;
  // «4 листа × 300 сом»
  detail: string;
  // null — цены нет, сумму назовёт менеджер.
  amount: number | null;
};

export type CuttingQuote = {
  lines: CuttingQuoteLine[];
  total: number;
  unpricedHoles: number;
};

const sources = new Set<CuttingExtras["source"]>([
  "calculator",
  "bazis",
  "manager",
]);

function validMeters(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100000
    ? Math.round(value * 100) / 100
    : null;
}

// Проверяет данные из браузера или из базы. Пустая присадка и нулевая
// фрезеровка — это «нет доп. работ», а не ошибка.
export function parseCuttingExtras(value: unknown): CuttingExtras | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const drilling: Record<string, number> = {};
  const rawDrilling =
    raw.drilling &&
    typeof raw.drilling === "object" &&
    !Array.isArray(raw.drilling)
      ? (raw.drilling as Record<string, unknown>)
      : null;
  if (!rawDrilling) return null;

  const entries = Object.entries(rawDrilling);
  if (entries.length > 50) return null;
  for (const [key, count] of entries) {
    const diameter = Number(key);
    if (!(diameter > 0 && diameter <= 100)) return null;
    if (
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > 1_000_000
    )
      return null;
    if (count > 0) {
      const normalized = String(Math.round(diameter * 10) / 10);
      drilling[normalized] = (drilling[normalized] ?? 0) + count;
    }
  }

  const curveMeters = validMeters(raw.curveMeters ?? 0);
  const bevelMeters = validMeters(raw.bevelMeters ?? 0);
  const grooveMeters = validMeters(raw.grooveMeters ?? 0);
  if (curveMeters === null || bevelMeters === null || grooveMeters === null)
    return null;
  const materialWork: Partial<Record<MaterialWorkKey, number>> = {};
  for (const key of allWorkKeys) {
    const amount = isSheetKey(key)
      ? validSheets(raw[key] ?? 0)
      : validMeters(raw[key] ?? 0);
    if (amount === null) return null;
    if (amount > 0) materialWork[key] = amount;
  }
  const source = sources.has(raw.source as CuttingExtras["source"])
    ? (raw.source as CuttingExtras["source"])
    : "manager";

  return {
    drilling,
    curveMeters,
    bevelMeters,
    ...(grooveMeters > 0 ? { grooveMeters } : {}),
    ...materialWork,
    source,
  };
}

export function hasCuttingExtras(extras: CuttingExtras | null | undefined) {
  return Boolean(
    extras &&
    (Object.keys(extras.drilling).length > 0 ||
      extras.curveMeters > 0 ||
      extras.bevelMeters > 0 ||
      (extras.grooveMeters ?? 0) > 0 ||
      hasMaterialWork(extras) ||
      hasHardwareWork(extras)),
  );
}

// Цены присадки и фрезеровки из сохранённого значения; без них — цены
// сайта по умолчанию (старые снимки прайса хранили только распил и кромку).
export function parseCuttingExtrasPrice(
  value: unknown,
  fallback: CuttingExtrasPrice = defaultSiteCuttingPrices,
): CuttingExtrasPrice {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const rawDrilling =
    raw.drilling &&
    typeof raw.drilling === "object" &&
    !Array.isArray(raw.drilling)
      ? (raw.drilling as Record<string, unknown>)
      : null;
  const drilling: Record<number, number> = {};
  if (rawDrilling) {
    for (const [key, price] of Object.entries(rawDrilling)) {
      const diameter = Number(key);
      if (diameter > 0 && isValidSitePrice(price)) drilling[diameter] = price;
    }
  }
  return {
    drilling: rawDrilling ? drilling : { ...fallback.drilling },
    milling: isValidSitePrice(raw.milling) ? raw.milling : fallback.milling,
    bevel: isValidSitePrice(raw.bevel) ? raw.bevel : fallback.bevel,
    groove: isValidSitePrice(raw.groove) ? raw.groove : fallback.groove,
    ...(Object.fromEntries(
      otherWorks.map((work) => {
        const saved = raw[work.price];
        return [
          work.price,
          isValidSitePrice(saved) ? saved : fallback[work.price],
        ];
      }),
    ) as Record<OtherWorkPriceKey, number>),
  };
}

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

function money(value: number) {
  return `${numberFormatter.format(value)} сом`;
}

function plural(count: number, forms: [string, string, string]) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return forms[1];
  return forms[2];
}

function holePrice(diameter: number, prices: Record<number, number>) {
  // Ø4,9 и Ø5,1 в проектах — то же сверло Ø5.
  const rounded = Math.round(diameter);
  return Math.abs(diameter - rounded) <= 0.2 ? (prices[rounded] ?? null) : null;
}

// Строки счёта. Без количества листов (или метража при выбранной кромке)
// счёт не строится: частичная сумма ввела бы клиента в заблуждение.
export function buildCuttingQuote(
  price: CuttingQuotePrice,
  request: {
    cuttingSheetCount?: number | null;
    cuttingEdgeMeters?: number | null;
    edgeOption?: string | null;
  },
  extras: CuttingExtras | null | undefined,
): CuttingQuote | null {
  // Заказ только из ХДФ, HPL или столешницы — без листов ЛДСП.
  const onlyOtherMaterials =
    !request.cuttingSheetCount && hasMaterialWork(extras);
  const labor = calculateCuttingLaborTotal(
    price,
    onlyOtherMaterials ? 1 : request.cuttingSheetCount,
    request.cuttingEdgeMeters,
    request.edgeOption,
  );
  if (labor === null) return null;

  const sheets = onlyOtherMaterials ? 0 : (request.cuttingSheetCount ?? 0);
  const edgeMeters = request.cuttingEdgeMeters ?? 0;
  const lines: CuttingQuoteLine[] = [];
  if (sheets > 0) {
    lines.push({
      key: "sheets",
      label: "Распил листов",
      detail: `${sheets} ${plural(sheets, ["лист", "листа", "листов"])} × ${money(price.sheetRate)}`,
      amount: (sheets * Math.round(price.sheetRate * 100)) / 100,
    });
  }

  if (edgeMeters > 0) {
    lines.push({
      key: "edge",
      label: "Кромление",
      detail: `${numberFormatter.format(edgeMeters)} м × ${money(price.edgeRate)}`,
      amount: (edgeMeters * Math.round(price.edgeRate * 100)) / 100,
    });
  }

  let extrasCents = 0;
  let unpricedHoles = 0;

  const pushWorkLines = (group: "material" | "hardware") => {
    for (const work of otherWorks) {
      if (work.group !== group) continue;
      const { key, label, unit, price: priceKey } = work;
      const rate = price[priceKey];
      const amount = extras?.[key] ?? 0;
      if (!(amount > 0)) continue;
      const cents = Math.round(amount * Math.round(rate * 100));
      extrasCents += cents;
      lines.push({
        key,
        label,
        detail:
          unit === "sheet"
            ? `${amount} ${plural(amount, ["лист", "листа", "листов"])} × ${money(rate)}`
            : unit === "pcs"
              ? `${amount} ${plural(amount, ["отверстие", "отверстия", "отверстий"])} × ${money(rate)}`
              : `${numberFormatter.format(amount)} м × ${money(rate)}`,
        amount: cents / 100,
      });
    }
  };
  pushWorkLines("material");
  const drillingRows = Object.entries(extras?.drilling ?? {})
    .map(([key, holes]) => ({ diameter: Number(key), holes }))
    .filter((row) => row.diameter > 0 && row.holes > 0)
    .sort((left, right) => left.diameter - right.diameter);

  for (const row of drillingRows) {
    const rate = holePrice(row.diameter, price.drilling);
    const label = `Присадка Ø${numberFormatter.format(row.diameter)} мм`;
    const holes = `${row.holes} ${plural(row.holes, ["отверстие", "отверстия", "отверстий"])}`;
    if (rate === null) {
      unpricedHoles += row.holes;
      lines.push({
        key: `drill-${row.diameter}`,
        label,
        detail: `${holes}, цену назовёт менеджер`,
        amount: null,
      });
      continue;
    }
    const cents = row.holes * Math.round(rate * 100);
    extrasCents += cents;
    lines.push({
      key: `drill-${row.diameter}`,
      label,
      detail: `${holes} × ${money(rate)}`,
      amount: cents / 100,
    });
  }

  pushWorkLines("hardware");

  const milling: Array<[string, string, number, number]> = [
    [
      "curve",
      "Фрезеровка (скругления)",
      extras?.curveMeters ?? 0,
      price.milling,
    ],
    ["bevel", "Пропил под углом", extras?.bevelMeters ?? 0, price.bevel],
    ["groove", "Паз в пласти", extras?.grooveMeters ?? 0, price.groove],
  ];
  for (const [key, label, meters, rate] of milling) {
    if (!(meters > 0)) continue;
    const cents = Math.round(meters * Math.round(rate * 100));
    extrasCents += cents;
    lines.push({
      key,
      label,
      detail: `${numberFormatter.format(meters)} м × ${money(rate)}`,
      amount: cents / 100,
    });
  }

  // Округляем один раз — от суммы всех строк в тыйынах, как в
  // calculateCuttingLaborTotal: строки и «Итог» всегда сходятся.
  const laborCents =
    sheets * Math.round(price.sheetRate * 100) +
    edgeMeters * Math.round(price.edgeRate * 100);
  const total = Math.round((laborCents + extrasCents) / 100);
  if (total > 2147483647) throw new Error("Сумма работ слишком большая.");
  return { lines, total, unpricedHoles };
}

// Поля формы менеджера: drill_<диаметр> — отверстий, curveMeters и
// bevelMeters — метры фрезеровки. Пустая форма — null (нет данных).
export function cuttingExtrasFromForm(
  form: FormData,
): { ok: true; extras: CuttingExtras | null } | { ok: false; message: string } {
  const drilling: Record<string, number> = {};
  let touched = false;

  for (const [name, raw] of form.entries()) {
    if (!name.startsWith("drill_") || typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    touched = true;
    const diameter = Number(name.slice(6).replace(",", "."));
    const count = Number(value);
    if (!(diameter > 0 && diameter <= 100))
      return { ok: false, message: "Проверьте диаметр присадки." };
    if (!Number.isInteger(count) || count < 0 || count > 1_000_000)
      return {
        ok: false,
        message: `Количество отверстий Ø${diameter} — целое число от 0.`,
      };
    if (count > 0) drilling[String(diameter)] = count;
  }

  const meters = (field: string) => {
    const raw = form.get(field);
    const value = typeof raw === "string" ? raw.trim().replace(",", ".") : "";
    if (!value) return 0;
    touched = true;
    return validMeters(Number(value));
  };
  const curveMeters = meters("curveMeters");
  const bevelMeters = meters("bevelMeters");
  const grooveMeters = meters("grooveMeters");
  if (curveMeters === null || bevelMeters === null || grooveMeters === null)
    return { ok: false, message: "Проверьте метры фрезеровки." };

  const materialWork: Partial<Record<MaterialWorkKey, number>> = {};
  for (const key of allWorkKeys) {
    const raw = form.get(key);
    const value = typeof raw === "string" ? raw.trim().replace(",", ".") : "";
    if (!value) continue;
    touched = true;
    const amount = isSheetKey(key)
      ? validSheets(Number(value))
      : validMeters(Number(value));
    if (amount === null)
      return {
        ok: false,
        message: isSheetKey(key)
          ? `${otherWorks.find((work) => work.key === key)?.label ?? "Количество"}: целое число от 0 до 10 000.`
          : "Проверьте метры в «Другие работы».",
      };
    if (amount > 0) materialWork[key] = amount;
  }

  return {
    ok: true,
    extras: touched
      ? {
          drilling,
          curveMeters,
          bevelMeters,
          ...(grooveMeters > 0 ? { grooveMeters } : {}),
          ...materialWork,
          source: "manager",
        }
      : null,
  };
}
