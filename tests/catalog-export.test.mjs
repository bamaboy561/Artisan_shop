import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import enums from "../generated/prisma/index.js";
import { loadAction } from "./load-action.mjs";

const exporter = loadAction("../features/admin/catalog-export.ts", {
  xlsx: XLSX,
});
const roles = loadAction("../lib/auth/roles.ts", {
  "@/generated/prisma": enums,
});
const importer = loadAction("../features/admin/product-import.ts", {
  xlsx: XLSX,
  "@/generated/prisma": enums,
});

test("editable export matches the import template and round-trips all supported fields", async () => {
  const input = data();
  input.products = [product({
    format: "2800 x 2070", thicknessMm: 18,
    imageUrl: "https://example.com/product.jpg",
    summary: "Краткое описание", description: "Полное описание",
  })];
  const bytes = exporter.createCatalogExport(input);
  const workbook = XLSX.read(bytes, { type: "array", cellNF: true });
  assert.deepEqual(workbook.SheetNames, ["Товары"]);
  assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets.Товары, { header: 1 })[0], [
    "Артикул", "Название", "Категория", "Бренд", "Цена", "Старая цена", "Остаток",
    "Формат", "Толщина", "Толщина кромки", "Ширина кромки", "Ссылка на фото",
    "Краткое описание", "Описание", "Статус", "Сценарий заказа", "Наличие",
  ]);
  assert.equal(workbook.Sheets.Товары.A2.t, "s");
  assert.equal(workbook.Sheets.Товары.A2.z, "@");
  assert.equal(workbook.Sheets.Товары.E2.t, "n");
  const result = await importer.parseProductImportFile(new File([bytes], "catalog.xlsx"));
  assert.equal(result.rows.length, 1);
  assert.equal(result.mappedColumns.length, 17);
  assert.deepEqual(result.rows[0].attributes, []);
  for (const field of ["sku", "name", "price", "compareAtPrice", "stockQuantity", "format", "thicknessMm", "edgeThicknessMm", "edgeWidthMm", "imageUrl", "summary", "description", "status", "orderMode", "inventoryStatus"])
    assert.equal(result.rows[0][field], input.products[0][field], field);
  assert.equal(result.rows[0].categoryName, "Петли");
  assert.equal(result.rows[0].brandName, "Hettich");
});

test("editable download exports drafts, archives and blanks without formula injection", async () => {
  const input = data();
  input.products = [product({ name: '=HYPERLINK("bad")', status: "DRAFT", inventoryStatus: "ON_REQUEST", orderMode: "REQUEST_PRICE", price: null }), product({ id: "archive", sku: "other", status: "ARCHIVED", inventoryStatus: "LIMITED", orderMode: "SERVICE" })];
  const bytes = exporter.createCatalogExport(input);
  const result = await importer.parseProductImportFile(new File([bytes], "catalog.xlsx"));
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows.find((row) => row.status === "DRAFT").name, input.products[0].name);
  assert.equal(result.rows.find((row) => row.status === "DRAFT").price, null);
  assert.equal(result.rows.find((row) => row.status === "ARCHIVED").inventoryStatus, "LIMITED");
  assert.equal(result.rows.find((row) => row.status === "DRAFT").inventoryStatus, "ON_REQUEST");
  const empty = XLSX.read(exporter.createCatalogExport({ products: [], categories: [], brands: [] }));
  assert.equal(empty.Sheets.Товары.A1.v, "Артикул");
});
function category(id, name, parentId = null) {
  return { id, name, parentId, slug: id, kind: "OTHER", sortOrder: 0 };
}
function product(overrides = {}) {
  return {
    id: "p",
    sku: "001234567890123456789",
    name: "Петля",
    slug: "hinge",
    categoryId: "leaf",
    brandId: "brand",
    status: "ACTIVE",
    orderMode: "CART",
    inventoryStatus: "IN_STOCK",
    price: 150,
    compareAtPrice: null,
    stockQuantity: 0,
    format: null,
    thicknessMm: null,
    edgeThicknessMm: 0.8,
    edgeWidthMm: 19,
    ...overrides,
  };
}
function data() {
  return {
    products: [product()],
    categories: [
      category("root", "Фурнитура"),
      category("mid", "Комплектующие", "root"),
      category("leaf", "Петли", "mid"),
      category("empty", "Пустая категория"),
    ],
    brands: [
      {
        id: "brand",
        name: "Hettich",
        slug: "hettich",
        country: null,
        website: null,
        logoUrl: null,
      },
      {
        id: "empty",
        name: "Albero",
        slug: "albero",
        country: null,
        website: null,
        logoUrl: null,
      },
    ],
  };
}
function read(input) {
  const workbook = XLSX.read(exporter.createCatalogAuditExport(input), {
    type: "array",
    cellNF: true,
  });
  const sheets = Object.fromEntries(
    workbook.SheetNames.map((name) => [
      name,
      XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: null }),
    ]),
  );
  return { workbook, sheets };
}
test("Excel preserves hierarchy, empty categories and brands, exact SKUs and typed numbers", () => {
  const input = data();
  const before = structuredClone(input);
  const { workbook, sheets } = read(input);
  assert.deepEqual(workbook.SheetNames, ["Товары", "Категории", "Бренды"]);
  const row = sheets.Товары[0];
  assert.equal(row.Артикул, "001234567890123456789");
  assert.equal(row.Группа, "Фурнитура");
  assert.equal(row.Категория, "Петли");
  assert.equal(
    row["Полный путь категории"],
    "Фурнитура → Комплектующие → Петли",
  );
  assert.equal(row.Цена, 150);
  assert.equal(row["Старая цена"], null);
  assert.equal(row.Остаток, 0);
  assert.equal(row["Толщина кромки, мм"], 0.8);
  assert.equal(row.Проверка, "");
  assert.equal(workbook.Sheets.Товары.B2.t, "s");
  assert.equal(workbook.Sheets.Товары.B2.z, "@");
  assert.equal(workbook.Sheets.Товары.J2.t, "n");
  assert.equal(sheets.Категории.length, 4);
  assert.equal(
    sheets.Категории.find((r) => r["ID категории"] === "empty")[
      "Товаров непосредственно в категории"
    ],
    0,
  );
  assert.equal(
    sheets.Бренды.find((r) => r.Бренд === "Albero")["Количество товаров"],
    0,
  );
  assert.equal(
    sheets.Бренды.find((r) => r.Бренд === "Hettich")["Количество товаров"],
    1,
  );
  assert.ok(workbook.Sheets.Товары["!autofilter"]);
  assert.deepEqual(input, before);
});
test("all products export without page limits including drafts and archives; names cannot create formulas", () => {
  const input = data();
  input.products = Array.from({ length: 250 }, (_, i) =>
    product({
      id: `p${i}`,
      sku: `00${i}`,
      name: `Товар ${249 - i}`,
      status: ["ACTIVE", "DRAFT", "ARCHIVED"][i % 3],
    }),
  );
  input.products[0].name = '=HYPERLINK("evil")';
  const { workbook, sheets } = read(input);
  assert.equal(sheets.Товары.length, 250);
  assert.deepEqual(
    new Set(sheets.Товары.map((r) => r.Статус)),
    new Set(["Опубликован", "Черновик", "Архив"]),
  );
  const formulaRow =
    sheets.Товары.findIndex((r) => r.Название.startsWith("=")) + 2;
  assert.equal(workbook.Sheets.Товары[`C${formulaRow}`].t, "s");
  assert.equal(workbook.Sheets.Товары[`C${formulaRow}`].f, undefined);
  assert.deepEqual(
    read({ ...input, products: [...input.products].reverse() }).sheets.Товары,
    sheets.Товары,
  );
});
test("broken category trees, cycles, missing brands and repeated SKUs are visible without dropping rows", () => {
  const input = data();
  input.categories.push(
    category("cycle-a", "A", "cycle-b"),
    category("cycle-b", "B", "cycle-a"),
    category("orphan", "Нет родителя", "missing"),
  );
  input.products = [
    product({ id: "cycle", categoryId: "cycle-a" }),
    product({ id: "orphan", categoryId: "orphan", sku: "other" }),
    product({
      id: "missing",
      categoryId: "missing",
      brandId: "missing",
      sku: "",
    }),
  ];
  input.products.push(product({ id: "duplicate", categoryId: "cycle-b" }));
  const { sheets } = read(input);
  assert.equal(sheets.Товары.length, 4);
  assert.match(
    sheets.Товары.find((r) => r["ID товара"] === "cycle").Проверка,
    /Цикл.*Повторяющийся/,
  );
  assert.match(
    sheets.Товары.find((r) => r["ID товара"] === "orphan").Проверка,
    /Не найдена категория/,
  );
  assert.match(
    sheets.Товары.find((r) => r["ID товара"] === "missing").Проверка,
    /Не найдена категория.*Не найден бренд.*Не указан артикул/,
  );
  assert.equal(
    sheets.Товары.find((r) => r["ID товара"] === "cycle").Группа,
    null,
  );
  assert.match(
    sheets.Категории.find((r) => r["ID категории"] === "orphan").Проверка,
    /Не найдена категория/,
  );
});
test("empty catalog still has all three sheets with Russian headers", () => {
  const { workbook, sheets } = read({
    products: [],
    categories: [],
    brands: [],
  });
  assert.deepEqual(workbook.SheetNames, ["Товары", "Категории", "Бренды"]);
  assert.equal(workbook.Sheets.Товары.B1.v, "Артикул");
  assert.ok(Object.values(sheets).every((rows) => rows.length === 0));
});

function routeFixture({
  role = "ADMIN",
  session = true,
  database = true,
  fail = false,
} = {}) {
  let reads = 0;
  const { GET } = loadAction("../app/api/admin/products/export/route.ts", {
    "@/lib/auth/dal": {
      getOptionalSession: async () =>
        session ? { userId: "staff", roleCode: role } : null,
    },
    "@/lib/auth/roles": roles,
    "@/lib/db": { hasDatabaseUrl: () => database },
    "@/lib/server/catalog-export": {
      getCatalogExportData: async () => {
        reads++;
        if (fail) throw new Error("private database credentials");
        return data();
      },
    },
    "@/features/admin/catalog-export": exporter,
  });
  return { GET, reads: () => reads };
}
test("export API denies guests and unrelated roles before reading data", async () => {
  const guest = routeFixture({ session: false });
  assert.equal((await guest.GET()).status, 401);
  assert.equal(guest.reads(), 0);
  for (const role of [
    "CUSTOMER",
    "DEALER",
    "CUTTING_MANAGER",
    "PRODUCTION_OPERATOR",
    "PRODUCTION_MANAGER",
  ]) {
    const fixture = routeFixture({ role });
    assert.equal((await fixture.GET()).status, 403);
    assert.equal(fixture.reads(), 0);
  }
});
test("authorized catalog staff download a private uncached Excel attachment", async () => {
  for (const role of ["MANAGER", "ADMIN", "SUPER_ADMIN"]) {
    const fixture = routeFixture({ role });
    const response = await fixture.GET();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type"), /spreadsheetml/);
    assert.match(
      response.headers.get("Content-Disposition"),
      /attachment; filename="artisan-catalog-.*\.xlsx"/,
    );
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("Vary"), "Cookie");
    assert.equal(XLSX.read(await response.arrayBuffer()).SheetNames.length, 1);
    assert.equal(fixture.reads(), 1);
  }
});
test("missing database and query failures return truthful errors, never an empty successful file", async () => {
  const missing = routeFixture({ database: false });
  assert.equal((await missing.GET()).status, 503);
  assert.equal(missing.reads(), 0);
  const failed = await routeFixture({ fail: true }).GET();
  assert.equal(failed.status, 500);
  assert.ok(!(await failed.text()).includes("private database credentials"));
});
test("database export reads all entities in one consistent snapshot without filters or pagination", async () => {
  const queries = [];
  let isolation;
  const stub = Object.fromEntries(
    ["product", "category", "brand"].map((entity) => [
      entity,
      {
        findMany: (query) => {
          queries.push({ entity, query });
          return Promise.resolve(
            entity === "product"
              ? data().products.map((item) => ({ ...item, images: [{ url: "https://example.com/product.jpg" }] }))
              : data()[entity === "category" ? "categories" : "brands"],
          );
        },
      },
    ]),
  );
  stub.$transaction = async (requests, options) => {
    isolation = options.isolationLevel;
    return Promise.all(requests);
  };
  const { getCatalogExportData } = loadAction(
    "../lib/server/catalog-export.ts",
    { "server-only": {}, "@/lib/db": { getDb: () => stub } },
  );
  assert.deepEqual(await getCatalogExportData(), {
    ...data(),
    products: data().products.map((item) => ({ ...item, imageUrl: "https://example.com/product.jpg" })),
  });
  assert.equal(isolation, "RepeatableRead");
  assert.equal(queries.length, 3);
  assert.ok(
    queries.every(({ query }) => !query.where && !query.take && !query.skip),
  );
});

test("download button saves the Excel attachment and restores its loading state", async (t) => {
  const states = [[], []];
  let hook = 0;
  const jsx = (type, props) => ({ type, props });
  const { CatalogExportButton } = loadAction(
    "../components/admin/catalog-export-button.tsx",
    {
      react: {
        useState: (initial) => {
          const index = hook++;
          return [initial, (value) => states[index].push(value)];
        },
      },
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "lucide-react": { Download: "Download", LoaderCircle: "LoaderCircle" },
    },
  );
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "/api/admin/products/export");
    assert.equal(options.cache, "no-store");
    return new Response(exporter.createCatalogExport(data()), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="artisan-catalog-test.xlsx"',
      },
    });
  });
  let clicked = false;
  let removed = false;
  let revoked = false;
  const link = {
    click: () => {
      clicked = true;
    },
    remove: () => {
      removed = true;
    },
  };
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: () => link,
    body: { appendChild: () => {} },
  };
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  t.mock.method(URL, "createObjectURL", (blob) => {
    assert.ok(blob.size > 0);
    return "blob:test";
  });
  t.mock.method(URL, "revokeObjectURL", (url) => {
    assert.equal(url, "blob:test");
    revoked = true;
  });
  t.mock.method(globalThis, "setTimeout", (callback) => {
    callback();
    return 0;
  });
  const view = CatalogExportButton();
  await view.props.children[0].props.onClick();
  assert.ok(clicked && removed && revoked);
  assert.equal(link.download, "artisan-catalog-test.xlsx");
  assert.deepEqual(states[0], [true, false]);
  assert.deepEqual(states[1], [""]);
});

test("download failures surface an error and restore the button without creating a fake file", async (t) => {
  const cases = [
    async () => Response.json({ error: "Нет доступа" }, { status: 403 }),
    async () =>
      new Response("<html>Login</html>", {
        headers: { "Content-Type": "text/html" },
      }),
    async () => {
      throw new Error("Соединение прервано");
    },
  ];
  for (const fetchResponse of cases) {
    const states = [[], []];
    let hook = 0;
    const jsx = (type, props) => ({ type, props });
    const { CatalogExportButton } = loadAction(
      "../components/admin/catalog-export-button.tsx",
      {
        react: {
          useState: (initial) => {
            const index = hook++;
            return [initial, (value) => states[index].push(value)];
          },
        },
        "react/jsx-runtime": { jsx, jsxs: jsx },
        "lucide-react": { Download: "Download", LoaderCircle: "LoaderCircle" },
      },
    );
    const fetchMock = t.mock.method(globalThis, "fetch", fetchResponse);
    const urlMock = t.mock.method(URL, "createObjectURL", () => {
      throw new Error("Must not download");
    });
    await CatalogExportButton().props.children[0].props.onClick();
    assert.deepEqual(states[0], [true, false]);
    assert.equal(states[1].length, 2);
    assert.ok(states[1][1]);
    assert.equal(urlMock.mock.callCount(), 0);
    fetchMock.mock.restore();
    urlMock.mock.restore();
  }
});
