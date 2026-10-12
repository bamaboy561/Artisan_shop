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
export type StockImportPlanEntry = StockImportEntry & {
  productId: string | null;
  updatedAt: string | null;
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
  match: "sku" | "name" | null;
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
      match: entry.productId ? (row.sku ? "sku" : "name") : null,
      status: entry.status,
      reason: entry.reason,
      selectable: entry.status === "ready",
    };
  });
  for (const product of products) {
    // An ambiguous match still references every candidate; absence is not proof of zero stock.
    if (
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

export function buildStockImportPlan(
  rows: ProductImportRow[],
  products: StockProduct[],
  mode: StockImportMode,
) {
  const bySku = groupBy(products, (product) => skuKey(product.sku));
  const byName = groupBy(products, (product) => nameKey(product.name));
  const plan: StockImportPlanEntry[] = rows.map((row) => {
    const matches = row.sku
      ? bySku.get(skuKey(row.sku))
      : byName.get(nameKey(row.name));
    const product = matches?.length === 1 ? matches[0] : null;
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
    };
    if (!product) {
      entry.reason = matches?.length
        ? "Несколько товаров совпадают. Уточните артикул."
        : "Товар не найден. Добавьте карточку через полный импорт товаров.";
      return entry;
    }
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
    const errors = fields.flatMap((field) =>
      row.stockImportErrors[field] ? [row.stockImportErrors[field]] : [],
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
      if (row[field] !== null) proposed[field] = row[field];
    }
    if (mode !== "price") {
      if (row.stockQuantity !== null) {
        proposed.inventoryStatus =
          row.stockQuantity <= 0
            ? InventoryStatus.OUT_OF_STOCK
            : row.stockQuantity <= 5
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
    entry.reason = row.sku
      ? ""
      : "Совпадение по уникальному названию (артикул в файле отсутствует)";
    return entry;
  });
  // Never silently choose the last warehouse/sheet row for the same product.
  const byProduct = groupBy(
    plan.filter((entry) => entry.productId),
    (entry) => entry.productId!,
  );
  for (const entries of byProduct.values()) {
    if (entries.length < 2) continue;
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
