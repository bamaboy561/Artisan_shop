import * as XLSX from "xlsx";

import {
  InventoryStatus,
  ProductOrderMode,
  ProductStatus,
} from "@/generated/prisma";

export type ProductImportRow = {
  inventoryReport?: boolean;
  stockUnit?: string;
  sheetName: string;
  stockImportErrors: Partial<
    Record<"price" | "compareAtPrice" | "stockQuantity", string>
  >;
  rowNumber: number;
  name: string;
  sku: string;
  slug: string | null;
  categoryName: string | null;
  brandName: string | null;
  price: number | null;
  compareAtPrice: number | null;
  stockQuantity: number | null;
  format: string | null;
  thicknessMm: number | null;
  edgeThicknessMm: number | null;
  edgeWidthMm: number | null;
  imageUrl: string | null;
  summary: string | null;
  description: string | null;
  status: ProductStatus | null;
  orderMode: ProductOrderMode | null;
  inventoryStatus: InventoryStatus | null;
  attributes: Array<{ name: string; value: string }>;
};

export type ProductImportParseResult = {
  fileName: string;
  sheetName: string;
  headerRowNumber: number;
  totalRows: number;
  rows: ProductImportRow[];
  mappedColumns: Array<{ source: string; target: string }>;
  warnings: string[];
  inventoryValuation: InventoryValuationImport | null;
};

export type InventoryValuationImport = {
  amount: number;
  fileName: string;
  sheetName: string;
  reportTitle: string | null;
};

type ImportField =
  | "name"
  | "sku"
  | "slug"
  | "categoryName"
  | "brandName"
  | "price"
  | "compareAtPrice"
  | "stockQuantity"
  | "format"
  | "thicknessMm"
  | "edgeThicknessMm"
  | "edgeWidthMm"
  | "imageUrl"
  | "summary"
  | "description"
  | "status"
  | "orderMode"
  | "inventoryStatus";

const MAX_IMPORT_ROWS = 20000;

const fieldLabels: Record<ImportField, string> = {
  name: "Название",
  sku: "Артикул / SKU",
  slug: "Адрес страницы",
  categoryName: "Категория",
  brandName: "Бренд",
  price: "Цена",
  compareAtPrice: "Старая цена",
  stockQuantity: "Остаток",
  format: "Формат",
  thicknessMm: "Толщина",
  edgeThicknessMm: "Толщина кромки",
  edgeWidthMm: "Ширина кромки",
  imageUrl: "Изображение",
  summary: "Краткое описание",
  description: "Описание",
  status: "Статус",
  orderMode: "Сценарий заказа",
  inventoryStatus: "Наличие",
};

const aliases: Record<ImportField, string[]> = {
  name: [
    "наименование",
    "номенклатура",
    "товар",
    "название",
    "полное наименование",
    "наименование товара",
    "name",
    "product",
    "title",
  ],
  sku: [
    "артикул",
    "sku",
    "код",
    "код 1с",
    "код 1c",
    "код товара",
    "код номенклатуры",
    "номенклатура код",
    "номенклатура.код",
    "внутренний код",
    "идентификатор",
    "id",
    "article",
    "vendor code",
    "erp code",
    "item no",
    "item number",
    "item code",
    "model",
    "model no",
    "barcode",
    "штрихкод",
  ],
  slug: ["slug", "url", "адрес страницы", "ссылка", "чпу"],
  categoryName: [
    "категория",
    "группа",
    "группа номенклатуры",
    "раздел",
    "тип товара",
    "вид номенклатуры",
    "category",
  ],
  brandName: [
    "бренд",
    "производитель",
    "марка",
    "торговая марка",
    "brand",
    "manufacturer",
  ],
  price: [
    "цена",
    "цена продажи",
    "розничная цена",
    "цена розница",
    "розница",
    "цена сайта",
    "цена интернет магазина",
    "цена интернет-магазина",
    "цена с ндс",
    "цена номенклатуры",
    "прайс",
    "price",
    "retail price",
  ],
  compareAtPrice: [
    "старая цена",
    "цена до скидки",
    "зачеркнутая цена",
    "compare price",
    "compare at price",
  ],
  stockQuantity: [
    "остаток",
    "остатки",
    "остаток на складе",
    "остаток по складу",
    "остаток на конец",
    "конечный остаток",
    "свободный остаток",
    "доступный остаток",
    "количество",
    "кол во",
    "кол-во",
    "количество остаток",
    "доступно",
    "в наличии",
    "на складе",
    "склад",
    "stock",
    "qty",
    "quantity",
    "on hand",
    "available",
    "available stock",
    "available quantity",
  ],
  format: [
    "формат",
    "размер",
    "размер листа",
    "формат листа",
    "габарит",
    "габариты",
    "лист",
    "format",
    "size",
  ],
  thicknessMm: [
    "толщина",
    "толщина мм",
    "толщина, мм",
    "толщина листа",
    "толщина плиты",
    "thickness",
  ],
  edgeThicknessMm: ["толщина кромки", "толщина кромки мм", "edge thickness"],
  edgeWidthMm: ["ширина кромки", "ширина кромки мм", "edge width"],
  imageUrl: [
    "фото",
    "изображение",
    "картинка",
    "ссылка на фото",
    "image",
    "image url",
    "picture",
  ],
  summary: [
    "краткое описание",
    "анонс",
    "описание краткое",
    "summary",
    "short description",
  ],
  description: ["описание", "полное описание", "description"],
  status: ["статус", "публикация", "status"],
  orderMode: ["сценарий заказа", "режим заказа", "тип продажи", "order mode"],
  inventoryStatus: [
    "наличие",
    "статус наличия",
    "доступность",
    "inventory",
    "availability",
  ],
};

const normalizedAliases = Object.entries(aliases).flatMap(([field, names]) =>
  names.map((name) => ({
    field: field as ImportField,
    name: normalizeKey(name),
  })),
);

export function slugifyImportValue(value: string) {
  const translitMap: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ы: "y",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return value
    .toLowerCase()
    .replace(/[ъь]/g, "")
    .replace(/[а-яё]/g, (char) => translitMap[char] ?? char)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function normalizeKey(value: string) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/["'`«»(){}\[\].,:;№#]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cellToString(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function parseNumber(value: unknown, round = true) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? (round ? Math.round(value) : value) : null;
  }
  const raw = cellToString(value)
    .replace(/\s+/g, "")
    .replace(/[^\d,.\-]/g, "");

  if (!raw) {
    return null;
  }

  const sign = raw.startsWith("-") ? "-" : "";
  const unsigned = raw.replace(/^-/, "");
  const separatorCount = (unsigned.match(/[,.]/g) ?? []).length;
  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  const lastSeparator = Math.max(lastComma, lastDot);
  const normalized =
    lastSeparator >= 0
      ? (() => {
          const integerPart = unsigned
            .slice(0, lastSeparator)
            .replace(/[,.]/g, "");
          const decimalPart = unsigned
            .slice(lastSeparator + 1)
            .replace(/[,.]/g, "");

          if (separatorCount === 1 && decimalPart.length === 3) {
            return `${sign}${integerPart}${decimalPart}`;
          }

          return `${sign}${integerPart || "0"}${decimalPart ? `.${decimalPart}` : ""}`;
        })()
      : `${sign}${unsigned}`;

  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return round ? Math.round(parsed) : parsed;
}

function parseInteger(value: unknown) {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.max(0, parsed);
}

const inventoryNameHeaders = new Set([
  "номенклатура",
  "наименование",
  "товар",
  "товары",
  "product",
  "products",
]);

const inventoryValueHeaders = new Set([
  "сумма",
  "сумма остатка",
  "стоимость",
  "стоимость остатка",
  "стоимость склада",
  "складская стоимость",
  "inventory value",
  "stock value",
  "total value",
]);

const inventoryTotalLabels = new Set([
  "товары",
  "всего",
  "итого",
  "итого товары",
  "итого товаров",
  "total",
  "grand total",
]);

function findInventoryColumn(row: unknown[], aliases: Set<string>) {
  return row.findIndex((cell) => aliases.has(normalizeKey(cellToString(cell))));
}

function getInventoryReportTitle(matrix: unknown[][], headerIndex: number) {
  for (const row of matrix.slice(0, headerIndex)) {
    for (const cell of row) {
      const title = cellToString(cell);
      const normalized = normalizeKey(title);

      if (
        normalized.includes("остатки товаров") ||
        normalized.includes("остаток товаров") ||
        normalized.includes("inventory balance") ||
        normalized.includes("stock balance")
      ) {
        return title;
      }
    }
  }

  return null;
}

function extractInventoryValuation(
  fileName: string,
  sheetName: string,
  matrix: unknown[][],
): InventoryValuationImport | null {
  const candidateHeaders = matrix.slice(0, 25);
  let headerIndex = -1;
  let nameColumn = -1;
  let valueColumn = -1;

  candidateHeaders.forEach((row, index) => {
    const nextNameColumn = findInventoryColumn(row, inventoryNameHeaders);
    const nextValueColumn = findInventoryColumn(row, inventoryValueHeaders);

    if (
      nextNameColumn >= 0 &&
      nextValueColumn >= 0 &&
      (headerIndex < 0 || row.filter((cell) => cellToString(cell)).length > 1)
    ) {
      headerIndex = index;
      nameColumn = nextNameColumn;
      valueColumn = nextValueColumn;
    }
  });

  if (headerIndex < 0 || nameColumn < 0 || valueColumn < 0) {
    return null;
  }

  for (const row of matrix.slice(headerIndex + 1)) {
    const label = normalizeKey(cellToString(row[nameColumn]));
    const amount = parseNumber(row[valueColumn], false);
    const isTotalRow =
      inventoryTotalLabels.has(label) ||
      label.startsWith("итого ") ||
      label.startsWith("всего ");

    if (isTotalRow && amount !== null && amount >= 0) {
      return {
        amount: Math.round(amount * 100) / 100,
        fileName,
        sheetName,
        reportTitle: getInventoryReportTitle(matrix, headerIndex),
      };
    }
  }

  return null;
}

function matchField(header: string) {
  const normalizedHeader = normalizeKey(header);

  if (!normalizedHeader) {
    return null;
  }

  const exact = normalizedAliases.find(
    (item) => item.name === normalizedHeader,
  );
  if (exact) {
    return exact.field;
  }

  const partial = normalizedAliases.find(
    (item) =>
      (item.name.length > 2 && normalizedHeader.includes(item.name)) ||
      (item.name.length > 4 && item.name.includes(normalizedHeader)),
  );

  return partial?.field ?? null;
}

function parseStatus(value: unknown) {
  const normalized = normalizeKey(cellToString(value));

  if (!normalized) {
    return null;
  }

  if (
    [
      "active",
      "опубликован",
      "опубликовано",
      "активен",
      "да",
      "true",
      "1",
    ].includes(normalized)
  ) {
    return ProductStatus.ACTIVE;
  }

  if (["archive", "archived", "архив", "архивный"].includes(normalized)) {
    return ProductStatus.ARCHIVED;
  }

  if (
    ["draft", "черновик", "не опубликован", "нет", "false", "0"].includes(
      normalized,
    )
  ) {
    return ProductStatus.DRAFT;
  }

  return null;
}

function parseOrderMode(value: unknown) {
  const normalized = normalizeKey(cellToString(value));

  if (!normalized) {
    return null;
  }

  if (normalized.includes("корзин") || normalized === "cart") {
    return ProductOrderMode.CART;
  }

  if (normalized.includes("сервис") || normalized.includes("услуг")) {
    return ProductOrderMode.SERVICE;
  }

  if (normalized.includes("запрос") || normalized.includes("цена")) {
    return ProductOrderMode.REQUEST_PRICE;
  }

  return null;
}

function parseInventoryStatus(value: unknown) {
  const normalized = normalizeKey(cellToString(value));

  if (!normalized) {
    return null;
  }

  if (normalized.includes("нет") || normalized.includes("out")) {
    return InventoryStatus.OUT_OF_STOCK;
  }

  if (normalized.includes("огранич") || normalized.includes("мало")) {
    return InventoryStatus.LIMITED;
  }

  if (normalized.includes("налич") || normalized === "in stock") {
    return InventoryStatus.IN_STOCK;
  }

  if (normalized.includes("запрос") || normalized.includes("заказ")) {
    return InventoryStatus.ON_REQUEST;
  }

  return null;
}

function findHeaderRow(rows: unknown[][]) {
  let bestIndex = 0;
  let bestScore = -1;

  rows.slice(0, 25).forEach((row, index) => {
    const mappedFields = new Set<ImportField>();

    row.forEach((cell) => {
      const field = matchField(cellToString(cell));
      if (field) {
        mappedFields.add(field);
      }
    });

    let score = mappedFields.size;
    if (mappedFields.has("name")) score += 4;
    if (mappedFields.has("sku")) score += 3;
    if (mappedFields.has("price")) score += 2;
    if (mappedFields.has("categoryName")) score += 1;
    if (mappedFields.has("brandName")) score += 1;

    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestIndex;
}

function getCell(
  row: unknown[],
  columnMap: Map<ImportField, number>,
  field: ImportField,
  fieldColumns?: Map<ImportField, number[]>,
) {
  const indexes =
    fieldColumns?.get(field) ??
    (columnMap.has(field) ? [columnMap.get(field) as number] : []);
  const firstIndex = indexes[0];

  for (const index of indexes) {
    const value = row[index];

    if (cellToString(value)) {
      return value;
    }
  }

  return firstIndex === undefined ? "" : row[firstIndex];
}

function parseProductImportSheet(
  fileName: string,
  sheetName: string,
  sheet: XLSX.WorkSheet,
  options: { stockReports?: boolean } = {},
): ProductImportParseResult {
  if (!sheetName || !sheet) {
    return {
      fileName,
      sheetName: "",
      headerRowNumber: 0,
      totalRows: 0,
      rows: [],
      mappedColumns: [],
      warnings: ["В файле не найден лист с таблицей."],
      inventoryValuation: null,
    };
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const nonEmptyRows = matrix
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.some((cell) => cellToString(cell).length > 0));
  const headerIndex = findHeaderRow(nonEmptyRows.map(({ row }) => row));
  const headerEntry = nonEmptyRows[headerIndex];
  const headers = headerEntry?.row ?? [];
  const unitColumn = headers.findIndex((header) =>
    ["ед изм", "единица измерения"].includes(
      normalizeKey(cellToString(header)),
    ),
  );
  const inventoryReport = Boolean(
    options.stockReports &&
    unitColumn >= 0 &&
    getInventoryReportTitle(matrix, headerEntry?.index ?? 0) &&
    headers.some(
      (header) => normalizeKey(cellToString(header)) === "номенклатура",
    ) &&
    headers.some(
      (header) => normalizeKey(cellToString(header)) === "количество",
    ),
  );
  const dataRows = nonEmptyRows.slice(
    headerIndex + 1,
    headerIndex + 1 + MAX_IMPORT_ROWS,
  );
  const columnMap = new Map<ImportField, number>();
  const fieldColumns = new Map<ImportField, number[]>();
  const mappedColumns: ProductImportParseResult["mappedColumns"] = [];
  const attributeColumns: Array<{ index: number; name: string }> = [];

  headers.forEach((header, index) => {
    const source = cellToString(header);
    const field = matchField(source);

    // Accounting valuation is not a selling price. Report imports only carry stock.
    if (
      inventoryReport &&
      field !== "name" &&
      field !== "sku" &&
      field !== "stockQuantity"
    ) {
      return;
    }

    if (field) {
      fieldColumns.set(field, [...(fieldColumns.get(field) ?? []), index]);

      if (!columnMap.has(field)) {
        columnMap.set(field, index);
        mappedColumns.push({ source, target: fieldLabels[field] });
      }

      return;
    }

    if (source) {
      attributeColumns.push({ index, name: source });
    }
  });

  if (!columnMap.has("name") && columnMap.has("description")) {
    const descriptionIndex = columnMap.get("description");

    if (descriptionIndex !== undefined) {
      columnMap.set("name", descriptionIndex);
      fieldColumns.set("name", [
        ...(fieldColumns.get("name") ?? []),
        descriptionIndex,
      ]);
      mappedColumns.push({
        source: cellToString(headers[descriptionIndex]),
        target: fieldLabels.name,
      });
    }
  }

  const warnings: string[] = [];
  if (inventoryReport) {
    warnings.push(
      "Распознан отчёт остатков: цены и суммы игнорируются во всех режимах. Товары, отсутствующие в отчёте, не обнуляются.",
    );
  }
  if (!columnMap.has("name")) {
    warnings.push("Не найдена колонка с названием товара.");
  }
  if (!columnMap.has("sku")) {
    warnings.push("Не найдена колонка с артикулом/SKU.");
  }
  if (matrix.length > headerIndex + 1 + MAX_IMPORT_ROWS) {
    warnings.push(`Импорт ограничен первыми ${MAX_IMPORT_ROWS} строками.`);
  }

  let carriedName = "";
  const productDataRows = inventoryReport
    ? dataRows.filter(({ row }) => {
        const label = normalizeKey(
          cellToString(getCell(row, columnMap, "name", fieldColumns)),
        );
        return (
          cellToString(row[unitColumn]) &&
          !inventoryTotalLabels.has(label) &&
          !label.startsWith("итого ") &&
          !label.startsWith("всего ")
        );
      })
    : dataRows;
  if (inventoryReport) {
    warnings.push(
      `Пропущено строк групп и итогов: ${dataRows.length - productDataRows.length}.`,
    );
  }
  const parsedRows = productDataRows.map(({ row, index }) => {
    // Reports format quantities to three decimals (81.000). Read the stored
    // numeric value, not a string that could be mistaken for thousands.
    const stockColumn = columnMap.get("stockQuantity");
    const stockCell =
      inventoryReport && stockColumn !== undefined
        ? sheet[XLSX.utils.encode_cell({ r: index, c: stockColumn })]
        : undefined;
    const stockValue =
      typeof stockCell?.v === "number"
        ? stockCell.v
        : getCell(row, columnMap, "stockQuantity", fieldColumns);
    const rawName = cellToString(getCell(row, columnMap, "name", fieldColumns));
    const sku = cellToString(getCell(row, columnMap, "sku", fieldColumns));
    const name = rawName || (sku ? carriedName : "");
    const attributes = attributeColumns
      .map((column, index) => ({
        name: column.name,
        value: cellToString(row[column.index]),
        sortOrder: (index + 1) * 10,
      }))
      .filter((attribute) => attribute.value)
      .map(({ name: attributeName, value }) => ({
        name: attributeName,
        value,
      }));
    const price = parseNumber(getCell(row, columnMap, "price", fieldColumns));
    const compareAtPrice = parseNumber(
      getCell(row, columnMap, "compareAtPrice", fieldColumns),
    );
    const stockQuantity = inventoryReport
      ? parseNumber(stockValue, false)
      : parseInteger(stockValue);
    const format =
      cellToString(getCell(row, columnMap, "format", fieldColumns)) || null;
    const thicknessMm = parseInteger(
      getCell(row, columnMap, "thicknessMm", fieldColumns),
    );
    const edgeThicknessMm = parseNumber(
      getCell(row, columnMap, "edgeThicknessMm", fieldColumns),
      false,
    );
    const edgeWidthMm = parseNumber(
      getCell(row, columnMap, "edgeWidthMm", fieldColumns),
      false,
    );
    const imageUrl =
      cellToString(getCell(row, columnMap, "imageUrl", fieldColumns)) || null;

    const stockImportErrors: ProductImportRow["stockImportErrors"] = {};
    for (const field of ["price", "compareAtPrice", "stockQuantity"] as const) {
      const cell =
        field === "stockQuantity"
          ? stockValue
          : getCell(row, columnMap, field, fieldColumns);
      if (!cellToString(cell)) continue;
      const number = parseNumber(cell, false);
      if (number === null || number < 0 || number > 2147483647) {
        stockImportErrors[field] = `${fieldLabels[field]}: некорректное число`;
      } else if (field === "stockQuantity" && !Number.isInteger(number)) {
        stockImportErrors[field] = "Остаток: требуется целое количество";
      }
    }

    if (rawName) {
      carriedName = rawName;
    }

    return {
      ...(inventoryReport
        ? { inventoryReport: true, stockUnit: cellToString(row[unitColumn]) }
        : {}),
      sheetName,
      stockImportErrors,
      rowNumber: index + 1,
      name,
      sku,
      slug: cellToString(getCell(row, columnMap, "slug", fieldColumns)) || null,
      categoryName:
        cellToString(getCell(row, columnMap, "categoryName", fieldColumns)) ||
        null,
      brandName:
        cellToString(getCell(row, columnMap, "brandName", fieldColumns)) ||
        null,
      price,
      compareAtPrice,
      stockQuantity,
      format,
      thicknessMm,
      edgeThicknessMm,
      edgeWidthMm,
      imageUrl,
      summary:
        cellToString(getCell(row, columnMap, "summary", fieldColumns)) || null,
      description:
        cellToString(getCell(row, columnMap, "description", fieldColumns)) ||
        null,
      status: parseStatus(getCell(row, columnMap, "status", fieldColumns)),
      orderMode: parseOrderMode(
        getCell(row, columnMap, "orderMode", fieldColumns),
      ),
      inventoryStatus: parseInventoryStatus(
        getCell(row, columnMap, "inventoryStatus", fieldColumns),
      ),
      attributes,
    } satisfies ProductImportRow;
  });
  const rows = parsedRows.filter((row) => {
    const hasIdentity = row.name || row.sku;
    const hasProductData =
      row.sku ||
      row.categoryName ||
      row.brandName ||
      row.price !== null ||
      row.compareAtPrice !== null ||
      row.stockQuantity !== null ||
      row.format ||
      row.thicknessMm !== null ||
      row.edgeThicknessMm !== null ||
      row.edgeWidthMm !== null ||
      row.imageUrl ||
      row.summary ||
      row.description ||
      row.status ||
      row.orderMode ||
      row.inventoryStatus ||
      row.attributes.length > 0;

    return hasIdentity && hasProductData;
  });

  if (inventoryReport) {
    const invalidStockRows = rows.filter(
      (row) => row.stockImportErrors.stockQuantity,
    ).length;
    if (invalidStockRows) {
      warnings.push(
        `Строк с некорректным или дробным остатком: ${invalidStockRows}. Они не будут обновлены; количества не округляются.`,
      );
    }
  }
  const ignoredRows = parsedRows.length - rows.length;
  if (ignoredRows > 0) {
    warnings.push(
      `Не распознано строк: ${ignoredRows}. Проверьте, что в них есть название или SKU и хотя бы одно поле для импорта.`,
    );
  }

  return {
    fileName,
    sheetName,
    headerRowNumber: (headerEntry?.index ?? 0) + 1,
    totalRows: rows.length,
    rows,
    mappedColumns,
    warnings,
    inventoryValuation: extractInventoryValuation(fileName, sheetName, matrix),
  };
}

export async function parseProductImportFile(
  file: File,
  options: { stockReports?: boolean } = {},
): Promise<ProductImportParseResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;
  if (/\.(csv|tsv)$/i.test(file.name)) {
    let text: string;
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      text = new TextDecoder("utf-16le").decode(buffer);
    } else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      text = new TextDecoder("utf-16be").decode(buffer);
    } else {
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder("windows-1251").decode(buffer);
      }
    }
    // CSV auto-number conversion would destroy long SKUs and leading zeroes.
    workbook = XLSX.read(text, { type: "string", raw: true });
  } else {
    workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  }
  const parsedSheets = workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];

    return sheet
      ? [parseProductImportSheet(file.name, sheetName, sheet, options)]
      : [];
  });

  if (parsedSheets.length === 0) {
    return {
      fileName: file.name,
      sheetName: "",
      headerRowNumber: 0,
      totalRows: 0,
      rows: [],
      mappedColumns: [],
      warnings: ["В файле не найден лист с таблицей."],
      inventoryValuation: null,
    };
  }

  const rows = parsedSheets
    .flatMap((result) => result.rows)
    .slice(0, MAX_IMPORT_ROWS);
  const mappedColumns = Array.from(
    new Map(
      parsedSheets
        .flatMap((result) => result.mappedColumns)
        .map((column) => [`${column.source}\u0000${column.target}`, column]),
    ).values(),
  );
  const warnings = parsedSheets.flatMap((result) =>
    result.warnings.map((warning) => `${result.sheetName}: ${warning}`),
  );
  const allRowsCount = parsedSheets.reduce(
    (total, result) => total + result.rows.length,
    0,
  );

  if (allRowsCount > MAX_IMPORT_ROWS) {
    warnings.push(
      `Импорт ограничен первыми ${MAX_IMPORT_ROWS} строками из всех листов.`,
    );
  }

  return {
    fileName: file.name,
    sheetName: parsedSheets.map((result) => result.sheetName).join(", "),
    headerRowNumber:
      parsedSheets.length === 1 ? parsedSheets[0].headerRowNumber : 0,
    totalRows: rows.length,
    rows,
    mappedColumns,
    warnings,
    inventoryValuation:
      parsedSheets
        .map((result) => result.inventoryValuation)
        .filter(
          (valuation): valuation is InventoryValuationImport =>
            valuation !== null,
        )
        .sort((left, right) => right.amount - left.amount)[0] ?? null,
  };
}
