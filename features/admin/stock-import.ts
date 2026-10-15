import { InventoryStatus } from "@/generated/prisma";
import type { ProductImportRow } from "@/features/admin/product-import";

export type StockImportMode = "all" | "stock" | "price";
export type StockValues = {
  price: number | null;
  compareAtPrice: number | null;
  stockQuantity: number | null;
  inventoryStatus: InventoryStatus;
};
export type StockProduct = StockValues & {
  id: string;
  sku: string;
  name: string;
  updatedAt: Date;
};
export type StockImportStatus =
  | "ready"
  | "unchanged"
  | "skipped"
  | "updated"
  | "conflict"
  | "error";
export type StockImportEntry = {
  sheet: string;
  row: number;
  sku: string;
  name: string;
  status: StockImportStatus;
  reason: string;
  before: StockValues | null;
  changes: Partial<StockValues>;
};
export type StockMatch = "sku" | "name" | "similar";
export type StockImportPlanEntry = StockImportEntry & {
  productId: string | null;
  updatedAt: string | null;
  match?: StockMatch | null;
};
export type StockImportResult = {
  phase: "preview" | "done" | "error";
  message: string;
  fingerprint?: string;
  fileName?: string;
  counts?: Record<StockImportStatus, number>;
  entries?: StockImportEntry[];
  total?: number;
  warnings?: string[];
  columns?: Array<{ source: string; target: string }>;
  reportCsv?: string;
  reconciliation?: StockReconciliationEntry[];
  pendingCount?: number;
};

export type StockReconciliationEntry = {
  key: string;
  sku: string;
  name: string;
  siteQuantity: number | null;
  fileQuantity: number | null;
  unit: string;
  difference: number | null;
  kind: "difference" | "unchanged" | "notFound" | "missing" | "review";
  match: StockMatch | null;
  status: StockImportStatus;
  reason: string;
  selectable: boolean;
};

export function stockRowKey(entry: { sheet: string; row: number }) {
  return JSON.stringify([entry.sheet, entry.row]);
}

export function buildStockReconciliation(
  rows: ProductImportRow[],
  products: StockProduct[],
  plan: StockImportPlanEntry[],
): StockReconciliationEntry[] {
  const referencedSkus = new Set(
    rows.filter((row) => row.sku).map((row) => skuKey(row.sku)),
  );
  const referencedNames = new Set(
    rows.filter((row) => !row.sku).map((row) => nameKey(row.name)),
  );
  const referencedIds = new Set(plan.map((entry) => entry.productId));
  const catalogSkus = new Set(products.map((product) => skuKey(product.sku)));
  const catalogNames = new Set(
    products.map((product) => nameKey(product.name)),
  );
  const entries: StockReconciliationEntry[] = plan.map((entry, index) => {
    const row = rows[index];
    const siteQuantity = entry.before?.stockQuantity ?? null;
    const fileQuantity = row.stockQuantity;
    const difference =
      siteQuantity !== null && fileQuantity !== null
        ? fileQuantity - siteQuantity
        : null;
    return {
      key: stockRowKey(entry),
      sku: entry.sku,
      name: entry.name,
      siteQuantity,
      fileQuantity,
      difference,
      unit: row.stockUnit ?? "",
      kind:
        entry.status === "skipped" ||
        entry.status === "error" ||
        entry.status === "conflict"
          ? !entry.productId &&
            !(row.sku
              ? catalogSkus.has(skuKey(row.sku))
              : catalogNames.has(nameKey(row.name)))
            ? "notFound"
            : "review"
          : entry.status === "unchanged"
            ? "unchanged"
            : "difference",
      match: entry.productId
        ? (entry.match ?? (row.sku ? "sku" : "name"))
        : null,
      status: entry.status,
      reason: entry.reason,
      selectable: entry.status === "ready",
    };
  });
  for (const product of products) {
    // An ambiguous match still references every candidate; absence is not proof of zero stock.
    if (
      referencedIds.has(product.id) ||
      referencedSkus.has(skuKey(product.sku)) ||
      referencedNames.has(nameKey(product.name))
    )
      continue;
    entries.push({
      key: `missing:${product.id}`,
      sku: product.sku,
      name: product.name,
      siteQuantity: product.stockQuantity,
      fileQuantity: null,
      difference: null,
      unit: "",
      kind: "missing",
      match: null,
      status: "skipped",
      selectable: false,
      reason: "Нет в загруженном файле. Остаток сайта не изменяется.",
    });
  }
  return entries;
}

export function stockReconciliationCsv(entries: StockReconciliationEntry[]) {
  const escape = (value: unknown) => {
    let text = value == null ? "" : String(value);
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const labels = {
    difference: "Расхождение",
    unchanged: "Совпадает",
    notFound: "Нет на сайте",
    missing: "Нет в файле",
    review: "Нужна проверка",
  };
  return (
    "\uFEFF" +
    [
      [
        "Артикул",
        "Товар",
        "На сайте до обновления",
        "В файле",
        "Разница",
        "Ед. изм.",
        "Сверка",
        "Результат",
        "Примечание",
      ],
      ...entries.map((entry) => [
        entry.sku,
        entry.name,
        entry.siteQuantity,
        entry.fileQuantity,
        entry.difference,
        entry.unit,
        labels[entry.kind],
        stockImportStatusLabels[entry.status],
        entry.reason,
      ]),
    ]
      .map((row) => row.map(escape).join(";"))
      .join("\r\n")
  );
}

export const stockImportStatusLabels: Record<StockImportStatus, string> = {
  ready: "Будет обновлён",
  unchanged: "Без изменений",
  skipped: "Пропущен",
  updated: "Обновлён",
  conflict: "Изменён другим пользователем",
  error: "Ошибка обновления",
};
export const inventoryStatusLabels: Record<InventoryStatus, string> = {
  IN_STOCK: "В наличии",
  LIMITED: "Ограничен",
  OUT_OF_STOCK: "Нет в наличии",
  ON_REQUEST: "Под запрос",
};

function skuKey(value: string) {
  // Preserve punctuation and leading zeroes: distinct SKUs must not be merged.
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/g, "")
    .replace(/[–—−]/g, "-");
}
function nameKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ");
}
function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    if (!value) continue;
    const group = groups.get(value);
    if (group) group.push(item);
    else groups.set(value, [item]);
  }
  return groups;
}

// Латиница и кириллица в 1С и на сайте смешиваются в одинаковых по виду
// буквах («ABS» и «АВS»), поэтому для сравнения названий приводим их к одной.
const homoglyphs: Record<string, string> = {
  а: "a",
  в: "b",
  с: "c",
  е: "e",
  н: "h",
  к: "k",
  м: "m",
  о: "o",
  р: "p",
  т: "t",
  х: "x",
  у: "y",
};
function looseSkuKey(value: string) {
  return skuKey(value)
    .replace(/[^0-9a-zа-я]/g, "")
    .replace(/(^|\D)0+(?=\d)/g, "$1");
}
function nameTokens(value: string) {
  return nameKey(value)
    .replace(
      /[абвгдеёжзийклмнопрстуфхцчшщъыьэюяa-z]/g,
      (char) => homoglyphs[char] ?? char,
    )
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(\d)(?=[a-zа-я])|([a-zа-я])(?=\d)/g, "$1$2 ")
    .split(/[^0-9a-zа-я.]+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}
function trigrams(tokens: string[]) {
  const text = ` ${[...tokens].sort().join(" ")} `;
  const grams = new Set<string>();
  for (let index = 0; index < text.length - 2; index += 1)
    grams.add(text.slice(index, index + 3));
  return grams;
}
function dice(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const item of left) if (right.has(item)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}
type NameProfile = {
  tokens: Set<string>;
  numbers: string[];
  grams: Set<string>;
};
function nameProfile(value: string): NameProfile {
  const tokens = nameTokens(value);
  return {
    tokens: new Set(tokens),
    numbers: tokens.filter((token) => /\d/.test(token)),
    grams: trigrams(tokens),
  };
}
// Числа в названии (толщина, размер, код цвета) различают товары: у похожих
// названий числа одного должны входить в числа другого.
function numbersCompatible(left: string[], right: string[]) {
  const [small, large] =
    left.length <= right.length ? [left, right] : [right, left];
  const pool = [...large];
  for (const number of small) {
    const index = pool.indexOf(number);
    if (index < 0) return false;
    pool.splice(index, 1);
  }
  return true;
}
const SIMILAR_MIN_SCORE = 0.72;
const SIMILAR_MIN_GAP = 0.08;
export function stockNameSimilarity(left: string, right: string) {
  return profileSimilarity(nameProfile(left), nameProfile(right));
}
function profileSimilarity(left: NameProfile, right: NameProfile) {
  if (!numbersCompatible(left.numbers, right.numbers)) return 0;
  return (dice(left.tokens, right.tokens) + dice(left.grams, right.grams)) / 2;
}

// Сопоставление строки отчёта с товаром сайта, от строгого к мягкому:
// артикул, артикул без знаков и ведущих нулей, артикул в названии,
// точное название и, наконец, однозначно похожее название.
function createStockMatcher<
  P extends { id: string; sku: string; name: string },
>(products: P[]) {
  const bySku = groupBy(products, (product) => skuKey(product.sku));
  const byLooseSku = groupBy(products, (product) => looseSkuKey(product.sku));
  const byName = groupBy(products, (product) => nameKey(product.name));
  const byNameToken = new Map<string, P[]>();
  const profiles = new Map<string, NameProfile>();
  for (const product of products) {
    const profile = nameProfile(product.name);
    profiles.set(product.id, profile);
    for (const token of profile.tokens) {
      const list = byNameToken.get(token);
      if (list) list.push(product);
      else byNameToken.set(token, [product]);
    }
  }
  const unique = (list: P[] | undefined) =>
    list?.length === 1 ? list[0] : null;
  const closest = (profile: NameProfile, candidates: Iterable<P>) => {
    let best: P | null = null;
    let bestScore = 0;
    let secondScore = 0;
    for (const candidate of candidates) {
      const score = profileSimilarity(profile, profiles.get(candidate.id)!);
      if (score > bestScore) {
        secondScore = bestScore;
        bestScore = score;
        best = candidate;
      } else if (score > secondScore) secondScore = score;
    }
    return { best, bestScore, secondScore };
  };

  return {
    find(row: { sku: string; name: string }): {
      product: P | null;
      matches: P[];
      via: StockMatch | null;
    } {
      const profile = nameProfile(row.name);
      if (row.sku) {
        const exact = bySku.get(skuKey(row.sku)) ?? [];
        if (exact.length === 1)
          return { product: exact[0], matches: exact, via: "sku" };
        if (exact.length > 1) {
          // Один артикул у нескольких товаров: выбираем по названию.
          const named = exact.filter(
            (product) => nameKey(product.name) === nameKey(row.name),
          );
          if (named.length === 1)
            return { product: named[0], matches: exact, via: "sku" };
          const { best, bestScore, secondScore } = closest(profile, exact);
          if (
            best &&
            bestScore >= SIMILAR_MIN_SCORE &&
            bestScore - secondScore >= SIMILAR_MIN_GAP
          )
            return { product: best, matches: exact, via: "sku" };
          return { product: null, matches: exact, via: null };
        }
        const loose = looseSkuKey(row.sku);
        const looseProduct =
          loose.length >= 3 ? unique(byLooseSku.get(loose)) : null;
        if (looseProduct)
          return { product: looseProduct, matches: [looseProduct], via: "sku" };
        // Артикул из 1С записан на сайте в названии товара.
        if (loose.length >= 4) {
          const inName = (byNameToken.get(loose) ?? []).filter(
            (product) => looseSkuKey(product.sku) !== loose,
          );
          if (inName.length === 1)
            return { product: inName[0], matches: inName, via: "sku" };
        }
      }
      const named = byName.get(nameKey(row.name)) ?? [];
      if (named.length === 1)
        return { product: named[0], matches: named, via: "name" };
      if (named.length > 1) return { product: null, matches: named, via: null };

      const candidates = new Set<P>();
      for (const token of profile.tokens) {
        if (token.length < 3) continue;
        for (const product of byNameToken.get(token) ?? [])
          candidates.add(product);
      }
      const { best, bestScore, secondScore } = closest(profile, candidates);
      if (
        best &&
        bestScore >= SIMILAR_MIN_SCORE &&
        bestScore - secondScore >= SIMILAR_MIN_GAP
      )
        return { product: best, matches: [best], via: "similar" };
      return { product: null, matches: [], via: null };
    },
  };
}

export function buildStockImportPlan(
  rows: ProductImportRow[],
  products: StockProduct[],
  mode: StockImportMode,
) {
  const matcher = createStockMatcher(products);
  const plan: StockImportPlanEntry[] = rows.map((row) => {
    const { product, matches, via } = matcher.find(row);
    const entry: StockImportPlanEntry = {
      sheet: row.sheetName,
      row: row.rowNumber,
      sku: row.sku,
      name: row.name,
      status: "skipped",
      reason: "",
      before: null,
      changes: {},
      productId: product?.id ?? null,
      updatedAt: product?.updatedAt.toISOString() ?? null,
      match: product ? via : null,
    };
    if (!product) {
      entry.reason = matches.length
        ? "Несколько товаров совпадают. Уточните артикул."
        : "Товар не найден. Добавьте карточку через полный импорт товаров.";
      return entry;
    }
    const fileName = row.name.trim();
    entry.name = product.name;
    entry.sku = product.sku;
    entry.before = {
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stockQuantity: product.stockQuantity,
      inventoryStatus: product.inventoryStatus,
    };
    const fields =
      mode === "stock" || (row.inventoryReport && mode === "all")
        ? (["stockQuantity"] as const)
        : mode === "price"
          ? (["price", "compareAtPrice"] as const)
          : (["price", "compareAtPrice", "stockQuantity"] as const);
    // Кромка и плинтус учитываются в 1С в метрах с дробной частью, а сайт
    // хранит целый остаток: дробное количество округляем вниз.
    const fractionalStock =
      row.stockQuantity !== null &&
      row.stockQuantity >= 0 &&
      row.stockQuantity <= 2147483647 &&
      !Number.isInteger(row.stockQuantity);
    const stockQuantity =
      row.stockQuantity !== null && fractionalStock
        ? Math.floor(row.stockQuantity)
        : row.stockQuantity;
    const errors = fields.flatMap((field) =>
      row.stockImportErrors[field] &&
      !(field === "stockQuantity" && fractionalStock)
        ? [row.stockImportErrors[field]]
        : [],
    );
    if (row.inventoryReport && mode === "price") {
      entry.reason =
        "Отчёт остатков не содержит цен продажи. Выберите «Только остатки».";
      return entry;
    }
    if (errors.length) {
      entry.reason = errors.join("; ");
      return entry;
    }
    const proposed: Partial<StockValues> = {};
    for (const field of fields) {
      const value = field === "stockQuantity" ? stockQuantity : row[field];
      if (value !== null) proposed[field] = value;
    }
    if (mode !== "price") {
      if (stockQuantity !== null) {
        proposed.inventoryStatus =
          stockQuantity <= 0
            ? InventoryStatus.OUT_OF_STOCK
            : stockQuantity <= 5
              ? InventoryStatus.LIMITED
              : InventoryStatus.IN_STOCK;
      } else if (row.inventoryStatus) {
        proposed.inventoryStatus = row.inventoryStatus;
      }
    }
    if (!Object.keys(proposed).length) {
      entry.reason =
        "Нет данных для выбранного режима. Пустые ячейки не меняют товар.";
      return entry;
    }
    entry.changes = Object.fromEntries(
      Object.entries(proposed).filter(
        ([key, value]) => product[key as keyof StockValues] !== value,
      ),
    );
    entry.status = Object.keys(entry.changes).length ? "ready" : "unchanged";
    entry.reason = [
      via === "similar"
        ? `Похожее название в файле: «${fileName}»`
        : via === "name"
          ? row.sku
            ? `Артикул ${row.sku} не найден на сайте, совпало название`
            : "Совпадение по уникальному названию (артикул в файле отсутствует)"
          : row.sku && skuKey(row.sku) !== skuKey(product.sku)
            ? `Артикул в файле: ${row.sku}`
            : "",
      fractionalStock && (fields as readonly string[]).includes("stockQuantity")
        ? `Остаток округлён вниз: ${String(row.stockQuantity).replace(".", ",")} → ${stockQuantity}`
        : "",
    ]
      .filter(Boolean)
      .join(". ");
    return entry;
  });
  // Never silently choose the last warehouse/sheet row for the same product.
  const byProduct = groupBy(
    plan.filter((entry) => entry.productId),
    (entry) => entry.productId!,
  );
  for (const entries of byProduct.values()) {
    if (entries.length < 2) continue;
    // Похожее название уступает точному совпадению с тем же товаром.
    const exact = entries.filter((entry) => entry.match !== "similar");
    if (exact.length === 1) {
      for (const entry of entries) {
        if (entry === exact[0]) continue;
        const row = rows[plan.indexOf(entry)];
        Object.assign(entry, {
          sku: row.sku,
          name: row.name,
          status: "skipped",
          reason:
            "Товар не найден. Добавьте карточку через полный импорт товаров.",
          before: null,
          changes: {},
          productId: null,
          updatedAt: null,
          match: null,
        });
      }
      continue;
    }
    for (const entry of entries) {
      entry.status = "skipped";
      entry.reason =
        "Товар повторяется в файле. Оставьте одну итоговую строку на артикул.";
      entry.changes = {};
    }
  }
  return plan;
}

export function summarizeStockImport(entries: StockImportEntry[]) {
  const counts: Record<StockImportStatus, number> = {
    ready: 0,
    unchanged: 0,
    skipped: 0,
    updated: 0,
    conflict: 0,
    error: 0,
  };
  for (const entry of entries) counts[entry.status]++;
  return counts;
}

export function stockImportReportCsv(entries: StockImportEntry[]) {
  function escape(value: unknown) {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  const header = [
    "Лист",
    "Строка",
    "Артикул",
    "Товар",
    "Результат",
    "Примечание",
    "Цена до",
    "Цена после",
    "Старая цена до",
    "Старая цена после",
    "Остаток до",
    "Остаток после",
    "Наличие до",
    "Наличие после",
  ];
  const rows = entries.map((entry) => {
    const after = { ...entry.before, ...entry.changes };
    return [
      entry.sheet,
      entry.row,
      entry.sku,
      entry.name,
      stockImportStatusLabels[entry.status],
      entry.reason,
      entry.before?.price,
      after.price,
      entry.before?.compareAtPrice,
      after.compareAtPrice,
      entry.before?.stockQuantity,
      after.stockQuantity,
      entry.before ? inventoryStatusLabels[entry.before.inventoryStatus] : "",
      after.inventoryStatus ? inventoryStatusLabels[after.inventoryStatus] : "",
    ];
  });
  return (
    "\uFEFF" +
    [header, ...rows].map((row) => row.map(escape).join(";")).join("\r\n")
  );
}

export type StockPendingCandidate = {
  matchKey: string;
  sku: string | null;
  name: string;
  unit: string | null;
  quantity: number | null;
  note: string | null;
};

// Один ключ на позицию: по артикулу, а без артикула по названию.
// Так повторная загрузка того же отчёта не создаёт дублей в списке.
export function stockPendingKey(item: { sku?: string | null; name: string }) {
  const sku = item.sku ? skuKey(item.sku) : "";
  return sku ? `sku:${sku}` : `name:${nameKey(item.name)}`;
}

export function collectStockPendingItems(
  reconciliation: StockReconciliationEntry[],
): StockPendingCandidate[] {
  const groups = groupBy(
    reconciliation.filter(
      (entry) => entry.kind === "notFound" && entry.name.trim(),
    ),
    (entry) => stockPendingKey(entry),
  );
  const items: StockPendingCandidate[] = [];
  for (const [baseKey, entries] of groups) {
    const names = groupBy(entries, (entry) => nameKey(entry.name));
    // В 1С один артикул бывает у разных позиций: каждая остаётся в списке
    // отдельно, а артикул помечается к исправлению.
    const sharedSku = names.size > 1;
    for (const [name, rows] of names) {
      const first = rows[0];
      const repeated = rows.length > 1;
      items.push({
        matchKey: sharedSku ? `${baseKey}|name:${name}` : baseKey,
        sku: first.sku.trim() || null,
        name: first.name.trim(),
        unit: first.unit.trim() || null,
        // Повтор одной позиции в файле не угадываем: количество не выбираем.
        quantity: repeated ? null : first.fileQuantity,
        note: sharedSku
          ? "Артикул повторяется в отчёте у разных позиций. Исправьте артикул в 1С перед добавлением."
          : repeated
            ? "Позиция повторяется в отчёте. Количество не определено."
            : null,
      });
    }
  }
  return items;
}

// Ключи строк отчёта, которые теперь нашлись на сайте (в том числе по
// похожему названию): такие позиции убираются из списка «Нет на сайте».
export function stockMatchedPendingKeys(
  rows: Array<{ sku: string; name: string }>,
  plan: StockImportPlanEntry[],
) {
  const keys = new Set<string>();
  plan.forEach((entry, index) => {
    const row = rows[index];
    if (!entry.productId || !row) return;
    const key = stockPendingKey(row);
    keys.add(key);
    keys.add(`${key}|name:${nameKey(row.name)}`);
  });
  return keys;
}

// Ключи товаров сайта: позиция уходит из списка, когда появляется товар
// с тем же артикулом (или с тем же названием, если артикула в файле не было).
export function stockPendingCatalogKeys(
  products: Array<{ sku: string; name: string }>,
) {
  const keys = new Set<string>();
  for (const product of products) {
    keys.add(stockPendingKey(product));
    keys.add(`name:${nameKey(product.name)}`);
    keys.add(`${stockPendingKey(product)}|name:${nameKey(product.name)}`);
  }
  return keys;
}
