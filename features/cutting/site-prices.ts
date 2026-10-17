// Цены работ на сайте: калькулятор распила, присадка из проекта Базиса,
// плашка «Раскрой через сайт дешевле». Меняются в админке на странице
// «Прайс работ»; пока там ничего не сохранено, действуют эти значения.

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
};

// Ø5 — как отверстие под полкодержатель, Ø8 — как отверстие D8.
// Отверстие другого диаметра цену не получает: его посчитает менеджер.
export const drillingDiameters = [3, 5, 6, 7, 8, 10, 15, 20, 25, 35] as const;

export const defaultSiteCuttingPrices: SiteCuttingPrices = {
  sheet: 300,
  sheetRegular: 350,
  edge: 28,
  edgeRegular: 35,
  drilling: {
    3: 4,
    5: 6,
    6: 8,
    7: 8,
    8: 10,
    10: 10,
    15: 13,
    20: 20,
    25: 21,
    35: 32,
  },
  milling: 200,
  bevel: 250,
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
      | "bevel",
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
