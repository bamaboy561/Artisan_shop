// Динамика цен продаж по уже сделанным заказам.
// У товара хранится только текущая цена, поэтому прошлые цены берём из
// строк заказов (OrderItem.unitPrice — цена за единицу в момент продажи).

export type PriceTrendLine = {
  productKey: string;
  name: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  soldAt: Date;
};

export type PriceTrendMonth = {
  key: string;
  label: string;
  // Цепной индекс цены: 100 = уровень цен в начале периода.
  index: number | null;
  comparedProducts: number;
  lines: number;
  quantity: number;
};

export type PriceTrendProduct = {
  productKey: string;
  name: string;
  sku: string | null;
  firstMonth: string;
  firstPrice: number;
  lastMonth: string;
  lastPrice: number;
  changePercent: number;
  quantity: number;
  monthsSold: number;
};

export type PriceTrendReport = {
  months: PriceTrendMonth[];
  products: PriceTrendProduct[];
  overallChangePercent: number | null;
  totalLines: number;
};

const monthNames = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

const monthKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bishkek",
  year: "numeric",
  month: "2-digit",
});

export function getPriceTrendMonthKey(date: Date) {
  // en-CA даёт «2026-11»; месяц считаем по времени Бишкека.
  return monthKeyFormatter.format(date).slice(0, 7);
}

export function formatPriceTrendMonth(key: string) {
  const [year, month] = key.split("-");
  return `${monthNames[Number(month) - 1] ?? month} ${year.slice(2)}`;
}

export function listPriceTrendMonths(endKey: string, count: number) {
  const [endYear, endMonth] = endKey.split("-").map(Number);
  const keys: string[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const total = endYear * 12 + (endMonth - 1) - offset;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
  }

  return keys;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildPriceTrendReport(
  lines: PriceTrendLine[],
  monthKeys: string[],
): PriceTrendReport {
  const monthSet = new Set(monthKeys);
  // productKey -> monthKey -> { amount, quantity, lines }
  const byProduct = new Map<
    string,
    {
      name: string;
      sku: string | null;
      months: Map<string, { amount: number; quantity: number }>;
      quantity: number;
    }
  >();
  const monthStats = new Map<string, { lines: number; quantity: number }>();
  let totalLines = 0;

  for (const line of lines) {
    if (line.unitPrice <= 0 || line.quantity <= 0) {
      continue;
    }

    const monthKey = getPriceTrendMonthKey(line.soldAt);

    if (!monthSet.has(monthKey)) {
      continue;
    }

    totalLines += 1;
    const product = byProduct.get(line.productKey) ?? {
      name: line.name,
      sku: line.sku,
      months: new Map(),
      quantity: 0,
    };
    const month = product.months.get(monthKey) ?? { amount: 0, quantity: 0 };
    month.amount += line.unitPrice * line.quantity;
    month.quantity += line.quantity;
    product.months.set(monthKey, month);
    product.quantity += line.quantity;
    byProduct.set(line.productKey, product);

    const stats = monthStats.get(monthKey) ?? { lines: 0, quantity: 0 };
    stats.lines += 1;
    stats.quantity += line.quantity;
    monthStats.set(monthKey, stats);
  }

  // Цепной индекс: в каждом месяце товар сравнивается со своей предыдущей
  // продажей, и месячные изменения перемножаются. Так приход или уход товара
  // из продаж не двигает индекс — двигают только изменения цен.
  const ratiosByMonth = new Map<string, number[]>();
  const baseMonths = new Set<string>();
  const products: PriceTrendProduct[] = [];

  for (const [productKey, product] of byProduct) {
    const soldMonths = monthKeys.filter((key) => product.months.has(key));

    // Сравнивать можно только товары, проданные хотя бы в двух разных месяцах.
    if (soldMonths.length < 2) {
      continue;
    }

    const averagePrice = (key: string) => {
      const month = product.months.get(key)!;
      return month.amount / month.quantity;
    };
    const firstMonth = soldMonths[0];
    const lastMonth = soldMonths[soldMonths.length - 1];
    const basePrice = averagePrice(firstMonth);
    baseMonths.add(firstMonth);

    for (let index = 1; index < soldMonths.length; index += 1) {
      const key = soldMonths[index];
      const ratios = ratiosByMonth.get(key) ?? [];
      ratios.push(averagePrice(key) / averagePrice(soldMonths[index - 1]));
      ratiosByMonth.set(key, ratios);
    }

    const lastPrice = averagePrice(lastMonth);
    products.push({
      productKey,
      name: product.name,
      sku: product.sku,
      firstMonth,
      firstPrice: Math.round(basePrice),
      lastMonth,
      lastPrice: Math.round(lastPrice),
      changePercent: round((lastPrice / basePrice - 1) * 100),
      quantity: product.quantity,
      monthsSold: soldMonths.length,
    });
  }

  let level = 100;
  let started = false;
  let lastIndex: number | null = null;
  const months = monthKeys.map((key) => {
    const ratios = ratiosByMonth.get(key) ?? [];
    const stats = monthStats.get(key) ?? { lines: 0, quantity: 0 };
    let index: number | null = null;

    if (ratios.length > 0) {
      level *= ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
      started = true;
      index = round(level);
    } else if (!started && baseMonths.has(key)) {
      // Месяц, от которого считаем: первые продажи сравниваемых товаров.
      index = 100;
    }

    if (index !== null) {
      lastIndex = index;
    }

    return {
      key,
      label: formatPriceTrendMonth(key),
      index,
      comparedProducts: ratios.length,
      lines: stats.lines,
      quantity: stats.quantity,
    };
  });

  products.sort(
    (left, right) =>
      Math.abs(right.changePercent) - Math.abs(left.changePercent) ||
      right.quantity - left.quantity,
  );

  // Общее изменение — последнее значение цепного индекса относительно 100.
  const overallChangePercent =
    started && lastIndex !== null ? round(lastIndex - 100) : null;

  return { months, products, overallChangePercent, totalLines };
}
