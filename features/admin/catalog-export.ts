import * as XLSX from "xlsx";

export type ExportCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  kind: string;
  sortOrder: number;
};
export type ExportBrand = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  website: string | null;
  logoUrl: string | null;
};
export type ExportProduct = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  categoryId: string;
  brandId: string | null;
  status: string;
  orderMode: string;
  inventoryStatus: string;
  price: number | null;
  compareAtPrice: number | null;
  stockQuantity: number | null;
  format: string | null;
  thicknessMm: number | null;
  edgeThicknessMm: number | null;
  edgeWidthMm: number | null;
  imageUrl?: string | null;
  summary?: string | null;
  description?: string | null;
};
export type CatalogExportData = {
  products: ExportProduct[];
  categories: ExportCategory[];
  brands: ExportBrand[];
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Опубликован",
  DRAFT: "Черновик",
  ARCHIVED: "Архив",
  CART: "Корзина",
  REQUEST_PRICE: "Запрос цены",
  SERVICE: "Услуга",
  IN_STOCK: "В наличии",
  LIMITED: "Ограничен",
  OUT_OF_STOCK: "Нет в наличии",
  ON_REQUEST: "Под запрос",
};
const compare = (left: string, right: string) =>
  left.localeCompare(right, "ru", { numeric: true });

export function createCatalogAuditExport(
  data: CatalogExportData,
): Uint8Array<ArrayBuffer> {
  const categories = new Map(
    data.categories.map((category) => [category.id, category]),
  );
  const brands = new Map(data.brands.map((brand) => [brand.id, brand]));
  const paths = new Map<string, { names: string[]; issue: string }>();
  function categoryPath(id: string) {
    const cached = paths.get(id);
    if (cached) return cached;
    const names: string[] = [];
    const visited = new Set<string>();
    let current: string | null = id;
    let issue = "";
    while (current) {
      if (visited.has(current)) {
        issue = "Цикл в дереве категорий";
        break;
      }
      visited.add(current);
      const category = categories.get(current);
      if (!category) {
        issue = `Не найдена категория: ${current}`;
        break;
      }
      names.unshift(category.name);
      current = category.parentId;
    }
    const result = { names, issue };
    paths.set(id, result);
    return result;
  }
  const categoryCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  const skuCounts = new Map<string, number>();
  for (const product of data.products) {
    categoryCounts.set(
      product.categoryId,
      (categoryCounts.get(product.categoryId) ?? 0) + 1,
    );
    if (product.brandId)
      brandCounts.set(
        product.brandId,
        (brandCounts.get(product.brandId) ?? 0) + 1,
      );
    skuCounts.set(product.sku, (skuCounts.get(product.sku) ?? 0) + 1);
  }
  const workbook = XLSX.utils.book_new();
  function append(
    name: string,
    headers: string[],
    rows: Array<Array<string | number | null>>,
    widths: number[],
    textColumns: number[],
  ) {
    if (rows.length > 1048575) throw new Error("Excel row limit exceeded");
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    sheet["!cols"] = widths.map((wch) => ({ wch }));
    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range(
        { r: 0, c: 0 },
        { r: rows.length, c: headers.length - 1 },
      ),
    };
    for (let row = 1; row <= rows.length; row++) {
      for (const column of textColumns) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (cell) {
          cell.t = "s";
          cell.z = "@";
        }
      }
    }
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  const products = [...data.products].sort(
    (a, b) =>
      compare(
        categoryPath(a.categoryId).names.join(" → "),
        categoryPath(b.categoryId).names.join(" → "),
      ) ||
      compare(a.name, b.name) ||
      compare(a.sku, b.sku) ||
      compare(a.id, b.id),
  );
  append(
    "Товары",
    [
      "ID товара",
      "Артикул",
      "Название",
      "Группа",
      "Категория",
      "Полный путь категории",
      "ID категории",
      "Бренд",
      "ID бренда",
      "Цена",
      "Старая цена",
      "Остаток",
      "Наличие",
      "Статус",
      "Сценарий заказа",
      "Формат",
      "Толщина, мм",
      "Толщина кромки, мм",
      "Ширина кромки, мм",
      "Адрес страницы",
      "Проверка",
    ],
    products.map((product) => {
      const path = categoryPath(product.categoryId);
      const brand = product.brandId ? brands.get(product.brandId) : null;
      const issues = [
        path.issue,
        product.brandId && !brand ? `Не найден бренд: ${product.brandId}` : "",
        !product.sku ? "Не указан артикул" : "",
        (skuCounts.get(product.sku) ?? 0) > 1 ? "Повторяющийся артикул" : "",
      ].filter(Boolean);
      return [
        product.id,
        product.sku,
        product.name,
        path.issue ? null : (path.names[0] ?? null),
        categories.get(product.categoryId)?.name ?? null,
        path.names.join(" → "),
        product.categoryId,
        brand?.name ?? null,
        product.brandId,
        product.price,
        product.compareAtPrice,
        product.stockQuantity,
        statusLabels[product.inventoryStatus] ?? product.inventoryStatus,
        statusLabels[product.status] ?? product.status,
        statusLabels[product.orderMode] ?? product.orderMode,
        product.format,
        product.thicknessMm,
        product.edgeThicknessMm,
        product.edgeWidthMm,
        product.slug,
        issues.join("; "),
      ];
    }),
    [
      28, 30, 65, 28, 32, 65, 28, 25, 28, 15, 15, 15, 22, 18, 22, 26, 18, 24,
      24, 35, 55,
    ],
    [0, 1, 6, 8],
  );
  const sortedCategories = [...data.categories].sort(
    (a, b) =>
      compare(
        categoryPath(a.id).names.join(" → "),
        categoryPath(b.id).names.join(" → "),
      ) || compare(a.id, b.id),
  );
  append(
    "Категории",
    [
      "ID категории",
      "Название",
      "Адрес страницы",
      "ID родителя",
      "Родительская категория",
      "Полный путь категории",
      "Тип",
      "Порядок",
      "Товаров непосредственно в категории",
      "Проверка",
    ],
    sortedCategories.map((category) => [
      category.id,
      category.name,
      category.slug,
      category.parentId,
      category.parentId
        ? (categories.get(category.parentId)?.name ?? null)
        : null,
      categoryPath(category.id).names.join(" → "),
      category.kind,
      category.sortOrder,
      categoryCounts.get(category.id) ?? 0,
      categoryPath(category.id).issue,
    ]),
    [28, 35, 35, 28, 35, 65, 22, 12, 38, 55],
    [0, 3],
  );
  append(
    "Бренды",
    [
      "ID бренда",
      "Бренд",
      "Адрес страницы",
      "Страна",
      "Сайт",
      "Логотип",
      "Количество товаров",
    ],
    [...data.brands]
      .sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id))
      .map((brand) => [
        brand.id,
        brand.name,
        brand.slug,
        brand.country,
        brand.website,
        brand.logoUrl,
        brandCounts.get(brand.id) ?? 0,
      ]),
    [28, 30, 32, 24, 50, 65, 24],
    [0],
  );
  return new Uint8Array(
    XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      compression: true,
    }),
  );
}

// Keep the editable download identical to the product-import template.
export function createCatalogExport(data: CatalogExportData): Uint8Array<ArrayBuffer> {
  const categories = new Map(data.categories.map((item) => [item.id, item.name]));
  const brands = new Map(data.brands.map((item) => [item.id, item.name]));
  const headers = [
    "Артикул", "Название", "Категория", "Бренд", "Цена", "Старая цена",
    "Остаток", "Формат", "Толщина", "Толщина кромки", "Ширина кромки",
    "Ссылка на фото", "Краткое описание", "Описание", "Статус", "Сценарий заказа", "Наличие",
  ];
  const products = [...data.products].sort((a, b) =>
    compare(categories.get(a.categoryId) ?? "", categories.get(b.categoryId) ?? "") ||
    compare(a.name, b.name) || compare(a.sku, b.sku) || compare(a.id, b.id),
  );
  if (products.length > 1048575) throw new Error("Excel row limit exceeded");
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...products.map((product) => [
    product.sku, product.name, categories.get(product.categoryId) ?? null,
    product.brandId ? brands.get(product.brandId) ?? null : null,
    product.price, product.compareAtPrice, product.stockQuantity, product.format,
    product.thicknessMm, product.edgeThicknessMm, product.edgeWidthMm,
    product.imageUrl ?? null, product.summary ?? null, product.description ?? null,
    statusLabels[product.status] ?? product.status,
    statusLabels[product.orderMode] ?? product.orderMode,
    statusLabels[product.inventoryStatus] ?? product.inventoryStatus,
  ])]);
  sheet["!cols"] = [25, 48, 28, 22, 15, 17, 14, 23, 14, 18, 18, 42, 44, 55, 22, 24, 22]
    .map((wch) => ({ wch }));
  sheet["!autofilter"] = { ref: `A1:Q${products.length + 1}` };
  for (let row = 1; row <= products.length; row++) {
    for (const column of [0, 1, 2, 3, 7, 11, 12, 13, 14, 15, 16]) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) { cell.t = "s"; cell.z = "@"; }
    }
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Товары");
  return new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true }));
}
