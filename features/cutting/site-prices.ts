// Цены работ на сайте: калькулятор распила, присадка из проекта Базиса,
// плашка «Раскрой через сайт дешевле». Меняются в админке на странице
// «Прайс работ»; пока там ничего не сохранено, действуют эти значения.

// Другие работы со своей ценой: ХДФ, HPL, столешница, утолщёнка, Gola
// (group "material") и отверстия под фурнитуру (group "hardware").
// key — количество в заявке, price — цена в «Цены на сайте».
// unit: sheet — листов, m — погонных метров, pcs — отверстий.
export const otherWorks = [
  {
    key: "hdfSheets",
    price: "hdfSheet",
    label: "Распил ХДФ",
    unit: "sheet",
    group: "material",
    fallback: 100,
  },
  {
    key: "hplCutMeters",
    price: "hplCut",
    label: "Пропил HPL",
    unit: "m",
    group: "material",
    fallback: 500,
  },
  {
    key: "countertopCutMeters",
    price: "countertopCut",
    label: "Пропил столешницы",
    unit: "m",
    group: "material",
    fallback: 100,
  },
  {
    key: "sinkCutMeters",
    price: "sinkCut",
    label: "Вырез под мойку",
    unit: "m",
    group: "material",
    fallback: 1500,
  },
  {
    key: "thickeningMeters",
    price: "thickening",
    label: "Изготовление утолщёнки",
    unit: "m",
    group: "material",
    fallback: 100,
  },
  {
    key: "countertopEdgeMeters",
    price: "countertopEdge",
    label: "Закатка утолщёнки / столешницы",
    unit: "m",
    group: "material",
    fallback: 60,
  },
  {
    key: "hdfGrooveMeters",
    price: "hdfGroove",
    label: "Паз под ХДФ 4 мм",
    unit: "m",
    group: "material",
    fallback: 100,
  },
  {
    key: "golaCMeters",
    price: "golaC",
    label: "Фрезеровка под Gola C",
    unit: "m",
    group: "material",
    fallback: 70,
  },
  {
    key: "golaLMeters",
    price: "golaL",
    label: "Фрезеровка под Gola L",
    unit: "m",
    group: "material",
    fallback: 50,
  },
  // Прайс-лист: отверстия под фурнитуру — своя цена за каждое отверстие,
  // а не по диаметру (минификс D15 — 25 сом, простое D15 — 13).
  {
    key: "minifixHoles",
    price: "minifix",
    label: "Отверстие под минификс D15",
    unit: "pcs",
    group: "hardware",
    fallback: 25,
  },
  {
    key: "confirmatHoles",
    price: "confirmat",
    label: "Отверстие под конфирмат",
    unit: "pcs",
    group: "hardware",
    fallback: 14,
  },
  {
    key: "dowelHoles",
    price: "dowel",
    label: "Отверстие под шкант",
    unit: "pcs",
    group: "hardware",
    fallback: 14,
  },
  {
    key: "rafixHoles",
    price: "rafix",
    label: "Отверстие под рафикс D5/D20",
    unit: "pcs",
    group: "hardware",
    fallback: 28,
  },
  {
    key: "tofikHoles",
    price: "tofik",
    label: "Отверстие под тофик D5/D25",
    unit: "pcs",
    group: "hardware",
    fallback: 33,
  },
  {
    key: "markHoles",
    price: "mark",
    label: "Сверление под метку",
    unit: "pcs",
    group: "hardware",
    fallback: 3,
  },
] as const;
export type OtherWork = (typeof otherWorks)[number];
export type OtherWorkKey = OtherWork["key"];
export type OtherWorkPriceKey = OtherWork["price"];

// Подписи единиц: «сом за лист», «5 шт.».
export const workUnitLabel = {
  sheet: { per: "лист", count: "листов" },
  m: { per: "метр", count: "м" },
  pcs: { per: "отверстие", count: "отв." },
} as const;

const otherWorkFallbacks = Object.fromEntries(
  otherWorks.map((work) => [work.price, work.fallback]),
) as Record<OtherWorkPriceKey, number>;

export type SiteCuttingPrices = {
  // Распил и кромление для раскроя, собранного на сайте.
  sheet: number;
  edge: number;
  // Обычные цены, с которыми сравнивает плашка.
  sheetRegular: number;
  edgeRegular: number;
  // Присадка: цена одного отверстия по диаметру, сом.
  drilling: Record<number, number>;
  // Фрезеровка криволинейки (скругления углов) и пропил под углом
  // (скосы торцов), сом за погонный метр.
  milling: number;
  bevel: number;
  // Паз в пласти (под LED-профиль и т. п.), сом за погонный метр.
  groove: number;
} & Record<OtherWorkPriceKey, number>;

// Ø5 — как отверстие под полкодержатель, Ø8 — как отверстие D8.
// Ø2,5 и Ø4 — кернение и саморезы из GibLab, Ø12 — шканты/втулки.
export const drillingDiameters = [
  2.5, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 35,
] as const;

export const defaultSiteCuttingPrices: SiteCuttingPrices = {
  sheet: 300,
  sheetRegular: 350,
  edge: 28,
  edgeRegular: 30,
  drilling: {
    2.5: 4,
    3: 4,
    4: 6,
    5: 6,
    6: 8,
    7: 8,
    8: 10,
    10: 10,
    12: 10,
    15: 13,
    20: 20,
    25: 21,
    35: 32,
  },
  milling: 200,
  bevel: 250,
  groove: 200,
  ...otherWorkFallbacks,
};

export function isValidSitePrice(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100000 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}

// Сохранённое в базе значение поверх цен по умолчанию: битое или
// отсутствующее поле не обнуляет цену, а оставляет прежнюю.
export function parseSiteCuttingPrices(value: unknown): SiteCuttingPrices {
  const saved =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<Record<keyof SiteCuttingPrices, unknown>>)
      : {};
  const pick = (
    key:
      | "sheet"
      | "edge"
      | "sheetRegular"
      | "edgeRegular"
      | "milling"
      | "bevel"
      | "groove"
      | OtherWorkPriceKey,
  ) => {
    const price = saved[key];
    return isValidSitePrice(price) ? price : defaultSiteCuttingPrices[key];
  };
  const savedDrilling =
    saved.drilling &&
    typeof saved.drilling === "object" &&
    !Array.isArray(saved.drilling)
      ? (saved.drilling as Record<string, unknown>)
      : {};
  const drilling: Record<number, number> = {};
  for (const diameter of drillingDiameters) {
    const price = savedDrilling[String(diameter)];
    drilling[diameter] = isValidSitePrice(price)
      ? price
      : defaultSiteCuttingPrices.drilling[diameter];
  }
  return {
    sheet: pick("sheet"),
    edge: pick("edge"),
    sheetRegular: pick("sheetRegular"),
    edgeRegular: pick("edgeRegular"),
    drilling,
    milling: pick("milling"),
    bevel: pick("bevel"),
    groove: pick("groove"),
    ...(Object.fromEntries(
      otherWorks.map((work) => [work.price, pick(work.price)]),
    ) as Record<OtherWorkPriceKey, number>),
  };
}

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

export function formatSitePrice(value: number) {
  return priceFormatter.format(value);
}

export type CuttingSiteIncentive = {
  badge: string;
  title: string;
  text: string;
  managerNote: string;
  offers: Array<{ label: string; was: string; now: string; unit: string }>;
};

// Плашка «Раскрой через сайт дешевле». Если цены сайта не ниже обычных,
// плашки нет, а расчёт всё равно идёт по ценам сайта.
export function buildCuttingSiteIncentive(
  prices: SiteCuttingPrices,
): CuttingSiteIncentive | null {
  const f = formatSitePrice;
  const sheetCheaper = prices.sheet < prices.sheetRegular;
  const edgeCheaper = prices.edge < prices.edgeRegular;
  if (!sheetCheaper && !edgeCheaper) return null;

  const sheetLine = `распил ${f(prices.sheet)} сом за лист вместо ${f(prices.sheetRegular)}`;
  const edgeLine = `кромление ${f(prices.edge)} сом за метр вместо ${f(prices.edgeRegular)}`;
  const versus = (price: number, regular: number) =>
    price < regular ? ` (вместо ${f(regular)})` : "";

  return {
    badge: sheetCheaper
      ? `−${f(prices.sheetRegular - prices.sheet)} сом`
      : `−${f(prices.edgeRegular - prices.edge)} сом`,
    title: `Раскрой через сайт дешевле: ${sheetCheaper ? sheetLine : edgeLine}`,
    text: `${sheetCheaper && edgeCheaper ? `${edgeLine[0].toUpperCase()}${edgeLine.slice(1)}. ` : ""}Соберите раскрой здесь сами, и мы посчитаем работу по сниженной цене. Материал по обычной цене, точную сумму подтвердит менеджер.`,
    managerNote: `Заявка с сайта: распил ${f(prices.sheet)} сом/лист${versus(prices.sheet, prices.sheetRegular)}, кромление ${f(prices.edge)} сом/м${versus(prices.edge, prices.edgeRegular)}.`,
    // Только услуги, которые через сайт действительно дешевле.
    offers: [
      ...(sheetCheaper
        ? [
            {
              label: "Распил",
              was: f(prices.sheetRegular),
              now: f(prices.sheet),
              unit: "сом/лист",
            },
          ]
        : []),
      ...(edgeCheaper
        ? [
            {
              label: "Кромление",
              was: f(prices.edgeRegular),
              now: f(prices.edge),
              unit: "сом/м",
            },
          ]
        : []),
    ],
  };
}

// Цена одного отверстия. Сначала точный диаметр из прайса, потом то же
// сверло (Ø4,9 и Ø5,1 — это Ø5), а если такого диаметра в прайсе нет —
// цена ближайшего диаметра (при равенстве — большего): так в сумму входят
// все отверстия проекта, какого бы диаметра они ни были.
export function drillHoleRate(
  diameter: number,
  prices: Record<number, number>,
): { rate: number; base: number } | null {
  if (!(diameter > 0)) return null;
  const priced = Object.entries(prices)
    .map(([key, value]) => ({ base: Number(key), rate: value }))
    .filter((row) => row.base > 0 && isValidSitePrice(row.rate));
  if (priced.length === 0) return null;
  const exact = priced.find((row) => Math.abs(row.base - diameter) < 0.01);
  if (exact) return exact;
  const rounded = Math.round(diameter);
  if (Math.abs(diameter - rounded) <= 0.2) {
    const same = priced.find((row) => row.base === rounded);
    if (same) return same;
  }
  return priced.reduce((best, row) => {
    const d = Math.abs(row.base - diameter);
    const bestD = Math.abs(best.base - diameter);
    return d < bestD || (d === bestD && row.base > best.base) ? row : best;
  });
}
