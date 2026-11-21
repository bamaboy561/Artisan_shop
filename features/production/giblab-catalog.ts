// Материалы сайта → каталог GibLab. В GibLab включена служба «Catalog Excel»
// (goods.xls, лист 1). Сайт собирает этот файл из товаров магазина в том же
// виде, что демо-каталог GibLab: id, paren_id, isfolder, code, name, unit,
// price, толщина, длина, ширина, параметры. Дерево: «Листовой материал» →
// категория → «ЛДСП - 16 мм» → «2800х2070» → декоры; «Кромочные материалы» →
// категория → кромка. Программа цеха перезаписывает файл, когда список меняется.
import * as XLSX from "xlsx";

export type GibLabCatalogSettings = {
  enabled: boolean;
  path: string;
};

export const defaultGibLabCatalogSettings: GibLabCatalogSettings = {
  enabled: true,
  path: "D:\\GibLabLocal\\goods.xls",
};

export function normalizeGibLabCatalogSettings(
  value: Record<string, unknown>,
): GibLabCatalogSettings {
  let path =
    typeof value.path === "string"
      ? value.path
          .replace(/[\u0000-\u001f]/g, "")
          .trim()
          .slice(0, 300)
      : "";
  if (path && !/\.xlsx?$/i.test(path))
    path = `${path.replace(/\\+$/, "")}\\goods.xls`;
  return {
    enabled: value.enabled === true,
    path: path || defaultGibLabCatalogSettings.path,
  };
}

export function parseGibLabCatalogSettings(
  raw: string | null | undefined,
): GibLabCatalogSettings {
  if (!raw) return defaultGibLabCatalogSettings;
  try {
    return normalizeGibLabCatalogSettings(
      JSON.parse(raw) as Record<string, unknown>,
    );
  } catch {
    return defaultGibLabCatalogSettings;
  }
}

// Столбцы как в демо goods.xls GibLab. Эти же буквы оператор один раз
// выбирает в окне «Catalog Excel» (Начальная строка — 2: в первой заголовки).
export const gibLabCatalogColumns = [
  { key: "id", letter: "A", setting: "ID", title: "id" },
  {
    key: "parentId",
    letter: "B",
    setting: "Родительский ID",
    title: "paren_id",
  },
  { key: "folder", letter: "C", setting: "Папка", title: "isfolder" },
  { key: "code", letter: "D", setting: "Код", title: "code" },
  { key: "name", letter: "E", setting: "Наименование", title: "name" },
  { key: "unit", letter: "F", setting: "Единица измерения", title: "unit" },
  { key: "price", letter: "G", setting: "Цена", title: "price" },
  { key: "thickness", letter: "H", setting: "Толщина", title: "Толщина" },
  { key: "length", letter: "I", setting: "Длина", title: "Длина" },
  { key: "width", letter: "J", setting: "Ширина", title: "Ширина" },
  { key: "params", letter: "K", setting: "Параметры", title: "Параметры" },
  { key: "stock", letter: "M", setting: "Склад", title: "Остаток" },
] as const;

export const gibLabCatalogStartRow = 2;

// Так в демо-каталоге GibLab помечена кромка (припуск на прифуговку 1 мм).
export const gibLabEdgeParams = '<tool.edgeline elWidthPreJoint="1"/>';

export type GibLabCatalogCategory = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  parentId: string | null;
};

export type GibLabCatalogProduct = {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  price: number | null;
  stockQuantity: number | null;
  format: string | null;
  thicknessMm: number | null;
  edgeThicknessMm: number | null;
  edgeWidthMm: number | null;
};

export type GibLabCatalogRow = {
  id: number;
  parentId: number | "";
  folder: 1 | "";
  code: string;
  name: string;
  unit: string;
  price: number | "";
  thickness: number | "";
  length: number | "";
  width: number | "";
  params: string;
  stock: number | "";
};

// «2800×2070», «2800*2070 мм», «2.75*1.83», «2,8х2,07 м» → мм, длинная
// сторона первой.
export function parseSheetSizeMm(
  ...sources: Array<string | null | undefined>
): { length: number; width: number } | null {
  for (const source of sources) {
    if (!source) continue;
    const match = source.match(
      /(\d{1,4}(?:[.,]\d{1,3})?)\s*[×xх*]\s*(\d{1,4}(?:[.,]\d{1,3})?)/iu,
    );
    if (!match) continue;
    const toMm = (raw: string) => {
      const value = Number(raw.replace(",", "."));
      return value < 10 ? Math.round(value * 1000) : Math.round(value);
    };
    const a = toMm(match[1]);
    const b = toMm(match[2]);
    // Лист — от 0,5 м²; мелочь вроде «19*1» — это кромка, не формат.
    if (a < 300 || b < 300 || (a * b) / 1_000_000 < 0.5) continue;
    return { length: Math.max(a, b), width: Math.min(a, b) };
  }
  return null;
}

export function isEdgeCategory(category: { slug: string; name: string }) {
  return /kromk/i.test(category.slug) || /кромк/i.test(category.name);
}

function isEdgeProduct(
  product: GibLabCatalogProduct,
  category: GibLabCatalogCategory | undefined,
) {
  return (
    (category ? isEdgeCategory(category) : false) ||
    /кромк/i.test(product.name) ||
    product.edgeWidthMm != null
  );
}

function cleanText(value: string) {
  return value
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Числовой id из ключа: один и тот же товар всегда получает тот же номер,
// чтобы проекты GibLab, где материал уже выбран, не теряли его.
function stableNumber(key: string) {
  let hash = 0x811c9dc5;
  for (const char of key) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return 100_000 + (hash % 900_000_000);
}

function sheetFolderName(
  category: GibLabCatalogCategory,
  thickness: number | null,
) {
  const base = /мдф/i.test(category.name)
    ? "МДФ"
    : /хдф|двп/i.test(category.name)
      ? "ХДФ"
      : /фанер/i.test(category.name)
        ? "Фанера"
        : "ЛДСП";
  return thickness ? `${base} - ${thickness} мм` : base;
}

const rootSheets = "Листовой материал";
const rootEdges = "Кромочные материалы";
const rootServices = "Услуги";

export type GibLabService = {
  path: string[];
  code: string;
  name: string;
  unit: string;
  price: number;
};

export type GibLabServicePrices = {
  sheet: number;
  edge: number;
  drilling: Record<number, number>;
  milling: number;
  bevel: number;
  groove: number;
};

// Работы цеха строками каталога: распил, кромление, присадка по диаметрам,
// фрезеровка. Коды постоянные, чтобы GibLab узнавал услугу после обновления.
export function buildGibLabServices(
  prices: GibLabServicePrices,
): GibLabService[] {
  const root = [rootServices];
  const services: GibLabService[] = [
    {
      path: root,
      code: "SVC-CUT",
      name: "Распил листа",
      unit: "лист",
      price: prices.sheet,
    },
    {
      path: root,
      code: "SVC-EDGE",
      name: "Кромление",
      unit: "м",
      price: prices.edge,
    },
  ];
  for (const [diameter, price] of Object.entries(prices.drilling)
    .map(([key, value]) => [Number(key), value] as const)
    .sort((a, b) => a[0] - b[0])) {
    services.push({
      path: [rootServices, "Присадка"],
      code: `SVC-DRILL-${diameter}`,
      name: `Сверление Ø${diameter} мм`,
      unit: "шт",
      price,
    });
  }
  services.push(
    {
      path: root,
      code: "SVC-MILL",
      name: "Фрезеровка криволинейная",
      unit: "м",
      price: prices.milling,
    },
    {
      path: root,
      code: "SVC-BEVEL",
      name: "Пропил под углом",
      unit: "м",
      price: prices.bevel,
    },
    {
      path: root,
      code: "SVC-GROOVE",
      name: "Паз в пласти",
      unit: "м",
      price: prices.groove,
    },
  );
  return services.filter(
    (service) => Number.isFinite(service.price) && service.price >= 0,
  );
}

// Только листовые материалы и кромка — фурнитура в раскрое не нужна.
export function buildGibLabCatalogRows(
  categories: GibLabCatalogCategory[],
  products: GibLabCatalogProduct[],
  services: GibLabService[] = [],
): GibLabCatalogRow[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const used = new Set<number>();
  const take = (key: string) => {
    let id = stableNumber(key);
    while (used.has(id)) id += 1;
    used.add(id);
    return id;
  };

  const folders = new Map<string, GibLabCatalogRow>();
  const folder = (path: string[]): number => {
    const key = path.join("\u0001");
    const existing = folders.get(key);
    if (existing) return existing.id;
    const parentId = path.length > 1 ? folder(path.slice(0, -1)) : "";
    const row: GibLabCatalogRow = {
      id: take(`f:${key}`),
      parentId,
      folder: 1,
      code: "",
      name: path[path.length - 1],
      unit: "",
      price: "",
      thickness: "",
      length: "",
      width: "",
      params: "",
      stock: "",
    };
    folders.set(key, row);
    return row.id;
  };

  const items: GibLabCatalogRow[] = [];
  const sorted = [...products].sort(
    (a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id),
  );
  const plan: Array<{
    product: GibLabCatalogProduct;
    path: string[];
    edge: boolean;
    size: { length: number; width: number } | null;
  }> = [];
  for (const product of sorted) {
    const category = byId.get(product.categoryId);
    const edge = isEdgeProduct(product, category);
    const size = edge ? null : parseSheetSizeMm(product.format, product.name);
    if (!edge && !size && category?.kind !== "PLATE") continue;
    const categoryName = cleanText(category?.name ?? "Прочее");
    const path = edge
      ? [rootEdges, categoryName]
      : [
          rootSheets,
          categoryName,
          sheetFolderName(
            category ?? {
              id: "",
              name: "",
              slug: "",
              kind: "",
              parentId: null,
            },
            product.thicknessMm,
          ),
          ...(size ? [`${size.length}х${size.width}`] : []),
        ];
    plan.push({ product, path, edge, size });
  }
  for (const entry of plan) {
    const parentId = folder(entry.path);
    const { product, edge, size } = entry;
    // Плиты в GibLab считаются в м², поэтому цену листа делим на площадь.
    const price =
      product.price == null
        ? ""
        : edge
          ? product.price
          : size
            ? Math.round(
                (product.price / ((size.length * size.width) / 1_000_000)) *
                  100,
              ) / 100
            : "";
    items.push({
      id: take(`p:${product.id}`),
      parentId,
      folder: "",
      code: cleanText(product.sku),
      name: cleanText(product.name),
      unit: edge ? "м" : "м2",
      price,
      thickness: edge
        ? (product.edgeThicknessMm ?? "")
        : (product.thicknessMm ?? ""),
      length: size?.length ?? "",
      width: edge ? (product.edgeWidthMm ?? "") : (size?.width ?? ""),
      params: edge ? gibLabEdgeParams : "",
      stock: product.stockQuantity ?? "",
    });
  }

  // Цены работ — те же, что в калькуляторе и счёте заявки на сайте.
  for (const service of services) {
    items.push({
      id: take(`s:${service.code}`),
      parentId: folder(service.path),
      folder: "",
      code: service.code,
      name: service.name,
      unit: service.unit,
      price: service.price,
      thickness: "",
      length: "",
      width: "",
      params: "",
      stock: "",
    });
  }

  // Папки раньше товаров, родитель раньше потомков.
  const folderRows = [...folders.entries()]
    .sort(
      ([a], [b]) =>
        a.split("\u0001").length - b.split("\u0001").length ||
        a.localeCompare(b, "ru"),
    )
    .map(([, row]) => row);
  return [...folderRows, ...items];
}

// Excel 97-2003 (.xls), как демо goods.xls GibLab; первый лист.
export function buildGibLabCatalogWorkbook(
  rows: GibLabCatalogRow[],
  bookType: "biff8" | "xlsx" = "biff8",
): Buffer {
  const width = 13; // до столбца M
  const header: Array<string | number> = Array(width).fill("");
  for (const column of gibLabCatalogColumns)
    header[column.letter.charCodeAt(0) - 65] = column.title;
  const data = rows.map((row) => {
    const line: Array<string | number> = Array(width).fill("");
    for (const column of gibLabCatalogColumns)
      line[column.letter.charCodeAt(0) - 65] = row[column.key];
    return line;
  });
  const sheet = XLSX.utils.aoa_to_sheet([header, ...data]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Лист1");
  return XLSX.write(book, { type: "buffer", bookType }) as Buffer;
}
