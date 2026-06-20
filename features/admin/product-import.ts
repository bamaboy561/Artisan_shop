import * as XLSX from "xlsx";

import {
  InventoryStatus,
  ProductOrderMode,
  ProductStatus,
} from "@/generated/prisma";

export type ProductImportRow = {
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

function parseNumber(value: unknown) {
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

  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function parseInteger(value: unknown) {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.max(0, parsed);
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
      normalizedHeader.includes(item.name) ||
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

export async function parseProductImportFile(
  file: File,
): Promise<ProductImportParseResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheetName || !sheet) {
    return {
      fileName: file.name,
      sheetName: "",
      headerRowNumber: 0,
      totalRows: 0,
      rows: [],
      mappedColumns: [],
      warnings: ["В файле не найден лист с таблицей."],
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
  const parsedRows = dataRows.map(({ row, index }) => {
      const rawName = cellToString(
        getCell(row, columnMap, "name", fieldColumns),
      );
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
      const stockQuantity = parseInteger(
        getCell(row, columnMap, "stockQuantity", fieldColumns),
      );
      const format =
        cellToString(getCell(row, columnMap, "format", fieldColumns)) || null;
      const thicknessMm = parseInteger(
        getCell(row, columnMap, "thicknessMm", fieldColumns),
      );
      const imageUrl =
        cellToString(getCell(row, columnMap, "imageUrl", fieldColumns)) || null;

      if (rawName) {
        carriedName = rawName;
      }

      return {
        rowNumber: index + 1,
        name,
        sku,
        slug:
          cellToString(getCell(row, columnMap, "slug", fieldColumns)) || null,
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
        imageUrl,
        summary:
          cellToString(getCell(row, columnMap, "summary", fieldColumns)) ||
          null,
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
        row.imageUrl ||
        row.summary ||
        row.description ||
        row.status ||
        row.orderMode ||
        row.inventoryStatus ||
        row.attributes.length > 0;

      return hasIdentity && hasProductData;
    });

  const ignoredRows = parsedRows.length - rows.length;
  if (ignoredRows > 0) {
    warnings.push(
      `Не распознано строк: ${ignoredRows}. Проверьте, что в них есть название или SKU и хотя бы одно поле для импорта.`,
    );
  }

  return {
    fileName: file.name,
    sheetName,
    headerRowNumber: (headerEntry?.index ?? 0) + 1,
    totalRows: rows.length,
    rows,
    mappedColumns,
    warnings,
  };
}
