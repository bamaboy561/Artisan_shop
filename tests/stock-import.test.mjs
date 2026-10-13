import assert from "node:assert/strict";
import test from "node:test";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import enums from "../generated/prisma/index.js";
import { loadAction } from "./load-action.mjs";

const parser = loadAction("../features/admin/product-import.ts", {
  xlsx: XLSX,
  "@/generated/prisma": enums,
});
const stock = loadAction("../features/admin/stock-import.ts", {
  "@/generated/prisma": enums,
});
const roles = loadAction("../lib/auth/roles.ts", {
  "@/generated/prisma": enums,
});
function excel(rows, secondSheet) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "Остатки",
  );
  if (secondSheet)
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(secondSheet),
      "Склад 2",
    );
  return new File(
    [XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })],
    "stock.xlsx",
  );
}
function product(overrides = {}) {
  return {
    id: "p1",
    sku: "001234567890123456789-AB",
    name: "Петля тестовая",
    price: 120,
    compareAtPrice: 150,
    stockQuantity: 8,
    inventoryStatus: enums.InventoryStatus.IN_STOCK,
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}
async function plan(rows, products = [product()], mode = "all", secondSheet) {
  const parsed = await parser.parseProductImportFile(excel(rows, secondSheet));
  return stock.buildStockImportPlan(parsed.rows, products, mode);
}
const sku = product().sku;

function accountingReport(secondSheet) {
  return excel(
    [
      ['ОсОО "Крона Кей Джи"'],
      ["Остатки товаров на 05 октября 2026 г."],
      [],
      ["Номенклатура", null, "Ед.изм", "Количество", "Цена за ед.", "Сумма"],
      ["Товары", null, null, 99999, 88888, 77777],
      ["Фурнитура", null, null, 99999, 88888, 77777],
      ["Петля тестовая", null, "шт", 2, 9999, 19998],
      ["Кромка", null, "пог. м", 127.1, 0, 0.01],
      ["Неизвестный товар", null, "шт", 1, 999, 999],
      ["Итого", null, null, null, null, 77777],
    ],
    secondSheet,
  );
}

test("accounting report imports only item stock, preserving source row numbers and prices", async () => {
  const parsed = await parser.parseProductImportFile(accountingReport(), {
    stockReports: true,
  });
  assert.equal(parsed.headerRowNumber, 4);
  assert.equal(parsed.rows.length, 3);
  assert.deepEqual(
    parsed.rows.map((row) => row.rowNumber),
    [7, 8, 9],
  );
  assert.ok(
    parsed.rows.every(
      (row) =>
        row.inventoryReport &&
        row.price === null &&
        row.compareAtPrice === null,
    ),
  );
  assert.deepEqual(
    parsed.mappedColumns.map((column) => column.target),
    ["Название", "Остаток"],
  );
  assert.ok(
    parsed.warnings.some(
      (warning) => warning.includes("цен") && warning.includes("игнорируются"),
    ),
  );
  assert.ok(
    parsed.warnings.some((warning) => warning.includes("групп и итогов: 3")),
  );
  const products = [
    product(),
    product({ id: "edge", name: "Кромка", sku: "edge" }),
  ];
  for (const mode of ["all", "stock"]) {
    const entries = stock.buildStockImportPlan(parsed.rows, products, mode);
    assert.deepEqual(entries[0].changes, {
      stockQuantity: 2,
      inventoryStatus: "LIMITED",
    });
    // Дробный остаток (метры кромки) округляется вниз, а не отбрасывается.
    assert.equal(entries[1].status, "ready");
    assert.match(entries[1].reason, /округлён вниз: 127,1 → 127/);
    assert.deepEqual(entries[1].changes, { stockQuantity: 127 });
    assert.equal(entries[2].status, "skipped");
  }
  const priceOnly = stock.buildStockImportPlan(parsed.rows, products, "price");
  assert.ok(
    priceOnly.every(
      (entry) =>
        entry.status === "skipped" && !Object.keys(entry.changes).length,
    ),
  );
});

test("report protection is per sheet and does not affect full import or regular price sheets", async () => {
  const regular = [
    ["Артикул", "Цена", "Остаток"],
    ["other", 70, 3],
  ];
  const parsed = await parser.parseProductImportFile(
    accountingReport(regular),
    { stockReports: true },
  );
  assert.equal(parsed.rows.length, 4);
  assert.equal(parsed.rows[3].inventoryReport, undefined);
  const entries = stock.buildStockImportPlan(
    parsed.rows,
    [product(), product({ id: "other", sku: "other" })],
    "all",
  );
  assert.equal(entries[0].changes.price, undefined);
  assert.equal(entries[3].changes.price, 70);
  const full = await parser.parseProductImportFile(accountingReport());
  assert.ok(full.rows.every((row) => row.inventoryReport === undefined));
  assert.ok(full.rows.some((row) => row.price === 9999));
});

test("accounting reports preserve zero stock and skip ambiguous names and repeated products", async () => {
  const file = excel([
    ["Остатки товаров на 05 октября 2026 г."],
    ["Номенклатура", "Ед.изм", "Количество", "Цена за ед.", "Сумма"],
    ["Петля тестовая", "шт", 0, 999, 0],
  ]);
  const parsed = await parser.parseProductImportFile(file, {
    stockReports: true,
  });
  const [entry] = stock.buildStockImportPlan(parsed.rows, [product()], "all");
  assert.deepEqual(entry.changes, {
    stockQuantity: 0,
    inventoryStatus: "OUT_OF_STOCK",
  });
  assert.equal(
    stock.buildStockImportPlan(
      parsed.rows,
      [product(), product({ id: "duplicate", sku: "other" })],
      "all",
    )[0].status,
    "skipped",
  );
  assert.ok(
    stock
      .buildStockImportPlan(
        [...parsed.rows, ...parsed.rows],
        [product()],
        "all",
      )
      .every((row) => row.status === "skipped"),
  );
});

test("three-decimal report formatting never multiplies stock by a thousand or hides fractions", async () => {
  const workbook = XLSX.read(await accountingReport().arrayBuffer());
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  sheet.D7.z = "0.000";
  sheet.D8.z = "0.000";
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "biff8" });
  const parsed = await parser.parseProductImportFile(
    new File([bytes], "report.xls"),
    { stockReports: true },
  );
  assert.equal(parsed.rows[0].stockQuantity, 2);
  assert.equal(parsed.rows[1].stockQuantity, 127.1);
  assert.match(
    parsed.rows[1].stockImportErrors.stockQuantity,
    /целое количество/,
  );
});

test("downloadable Excel template has separate Russian headers and text-formatted SKUs", async () => {
  const bytes = readFileSync(
    new URL(
      "../public/templates/product-stock-update-template.xlsx",
      import.meta.url,
    ),
  );
  const workbook = XLSX.read(bytes, {
    type: "buffer",
    cellNF: true,
    sheetStubs: true,
  });
  assert.equal(workbook.SheetNames.length, 1);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  assert.deepEqual(
    XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })[0],
    ["Артикул", "Название", "Цена", "Остаток", "Наличие"],
  );
  assert.equal(sheet.A2.z, "@");
  const empty = await parser.parseProductImportFile(
    new File([bytes], "template.xlsx"),
  );
  assert.equal(empty.rows.length, 0);
  const numericSku = "001234567890123456789";
  XLSX.utils.sheet_add_aoa(
    sheet,
    [[numericSku, "Петля тестовая", 150, 2, "В наличии"]],
    { origin: "A2" },
  );
  const filled = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const parsed = await parser.parseProductImportFile(
    new File([filled], "filled.xlsx"),
  );
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].sku, numericSku);
  assert.equal(parsed.rows[0].price, 150);
  assert.equal(parsed.rows[0].stockQuantity, 2);
  assert.equal(parsed.mappedColumns.length, 5);
});

test("legacy CSV template declares UTF-8 and the Excel separator and remains importable", async () => {
  const bytes = readFileSync(
    new URL(
      "../public/templates/product-stock-update-template.csv",
      import.meta.url,
    ),
  );
  assert.equal(bytes.subarray(0, 3).toString("hex"), "efbbbf");
  assert.ok(
    bytes.toString("utf8").startsWith("\uFEFFsep=;\n") ||
      bytes.toString("utf8").startsWith("\uFEFFsep=;\r\n"),
  );
  const parsed = await parser.parseProductImportFile(
    new File([bytes], "template.csv"),
  );
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].sku, "EXT-001");
  assert.equal(parsed.rows[0].name, "Дуб Уральский E1");
  assert.equal(parsed.rows[0].price, 5500);
  assert.equal(parsed.rows[1].stockQuantity, 0);
});

test("preview preserves long and leading-zero SKUs and builds only inventory/price changes", async () => {
  const [row] = await plan([
    ["Артикул", "Цена", "Остаток", "Описание", "Фото"],
    [sku, 100, 2, "replace", "https://example.com/new.png"],
  ]);
  assert.equal(row.sku, sku);
  assert.equal(row.status, "ready");
  assert.deepEqual(row.changes, {
    price: 100,
    stockQuantity: 2,
    inventoryStatus: "LIMITED",
  });
  assert.equal(row.sheet, "Остатки");
  assert.equal(row.row, 2);
});
test("price-only ignores stock and stock-only ignores price including invalid unselected fields", async () => {
  const rows = [
    ["Артикул", "Цена", "Остаток"],
    [sku, 70, 0],
  ];
  assert.deepEqual((await plan(rows, [product()], "price"))[0].changes, {
    price: 70,
  });
  assert.deepEqual((await plan(rows, [product()], "stock"))[0].changes, {
    stockQuantity: 0,
    inventoryStatus: "OUT_OF_STOCK",
  });
  assert.equal(
    (
      await plan(
        [
          ["Артикул", "Цена", "Остаток"],
          [sku, -1, 4],
        ],
        [product()],
        "stock",
      )
    )[0].status,
    "ready",
  );
});
test("empty cells preserve values; absent products are never zeroed; zero stock wins over conflicting status", async () => {
  const [empty] = await plan([
    ["Артикул", "Цена", "Остаток"],
    [sku, "", ""],
  ]);
  assert.equal(empty.status, "skipped");
  assert.deepEqual(empty.changes, {});
  const rows = await plan(
    [
      ["Артикул", "Остаток", "Наличие"],
      [sku, 0, "В наличии"],
    ],
    [product(), product({ id: "p2", sku: "not-in-file" })],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].changes.inventoryStatus, "OUT_OF_STOCK");
});
test("unknown SKU never falls back to an unrelated matching name", async () => {
  const [row] = await plan([
    ["Артикул", "Название", "Цена"],
    ["missing", product().name, 10],
  ]);
  assert.equal(row.status, "skipped");
  assert.equal(row.productId, null);
});
test("unique-name fallback is explicit and ambiguous names or SKUs are skipped", async () => {
  const rows = [
    ["Название", "Цена"],
    [product().name, 10],
  ];
  const [unique] = await plan(rows);
  assert.equal(unique.status, "ready");
  assert.match(unique.reason, /названию/);
  assert.equal(
    (await plan(rows, [product(), product({ id: "p2" })]))[0].status,
    "skipped",
  );
  assert.equal(
    (
      await plan(
        [
          ["Артикул", "Цена"],
          [sku, 10],
        ],
        [product(), product({ id: "p2" })],
      )
    )[0].status,
    "skipped",
  );
});
test("repeated products across sheets are all skipped instead of last row winning", async () => {
  const rows = [
    ["Артикул", "Остаток"],
    [sku, 5],
  ];
  const entries = await plan(rows, [product()], "all", [
    ["Артикул", "Остаток"],
    [sku, 20],
  ]);
  assert.equal(entries.length, 2);
  assert.ok(
    entries.every(
      (entry) =>
        entry.status === "skipped" && !Object.keys(entry.changes).length,
    ),
  );
  assert.equal(entries[1].sheet, "Склад 2");
});
test("negative, fractional stock, malformed values and integer overflow are reported", async () => {
  for (const [field, value] of [
    ["Цена", -10],
    ["Остаток", -3],
    ["Остаток", "0,8"],
    ["Цена", "нет"],
    ["Остаток", 2147483648],
  ]) {
    const [row] = await plan([
      ["Артикул", field],
      [sku, value],
    ]);
    assert.equal(row.status, "skipped", `${field}: ${value}`);
    assert.ok(row.reason);
    assert.deepEqual(row.changes, {});
  }
});
test("unchanged values do not generate writes; SKU punctuation remains meaningful", async () => {
  assert.equal(
    (
      await plan([
        ["Артикул", "Цена", "Остаток"],
        [sku, 120, 8],
      ])
    )[0].status,
    "unchanged",
  );
  const [row] = await plan(
    [
      ["Артикул", "Цена"],
      ["A.00", 5],
    ],
    [product({ sku: "A" })],
  );
  assert.equal(row.status, "skipped");
});
test("CSV/TSV and report numeric formats are parsed using the existing Excel parser", async () => {
  for (const separator of [";", "\t"]) {
    const parsed = await parser.parseProductImportFile(
      new File(
        [
          `Артикул${separator}Цена${separator}Остаток\n${sku}${separator}1 250${separator}12`,
        ],
        separator === ";" ? "stock.csv" : "stock.tsv",
      ),
    );
    const entries = stock.buildStockImportPlan(parsed.rows, [product()], "all");
    assert.equal(entries[0].changes.price, 1250);
    assert.equal(entries[0].changes.stockQuantity, 12);
  }
});
test("CSV report includes all outcomes and neutralizes spreadsheet formula injection", async () => {
  const entries = await plan([
    ["Артикул", "Название", "Цена"],
    ["=1+1", "@test", 1],
    [sku, "", 80],
  ]);
  const csv = stock.stockImportReportCsv(entries);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("'=1+1"));
  assert.ok(csv.includes("'@test"));
  assert.ok(csv.includes("Будет обновлён"));
  assert.ok(csv.includes("Пропущен"));
});

test("CSV preserves numeric-only SKUs in UTF-8, Windows-1251 and UTF-16", async () => {
  const numericSku = "001234567890123456789";
  const source = `Артикул;Название;Цена;Остаток\r\n${numericSku};Петля;85;4`;
  const windows1251 = Buffer.from(
    Array.from(source, (character) => {
      const code = character.charCodeAt(0);
      return code >= 0x410 && code <= 0x44f ? code - 0x410 + 0xc0 : code;
    }),
  );
  const utf16le = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(source, "utf16le"),
  ]);
  const utf16be = Buffer.from(utf16le).swap16();
  for (const bytes of [Buffer.from(source), windows1251, utf16le, utf16be]) {
    const parsed = await parser.parseProductImportFile(
      new File([bytes], "stock.csv"),
    );
    assert.equal(parsed.rows[0].sku, numericSku);
    assert.equal(parsed.rows[0].name, "Петля");
    assert.equal(parsed.rows[0].price, 85);
    assert.equal(parsed.rows[0].stockQuantity, 4);
  }
});

function actionFixture({
  role = "ADMIN",
  conflict = false,
  fail = false,
  failBatch = 0,
  database = true,
} = {}) {
  const state = {
    products: [product()],
    writes: [],
    invalidations: [],
    reads: 0,
    parses: 0,
    batches: 0,
    pending: [],
  };
  const action = loadAction("../app/admin/products/stock-import-actions.ts", {
    "node:crypto": crypto,
    "next/cache": {
      revalidatePath: (...args) => state.invalidations.push(args),
    },
    "@/features/admin/product-import": {
      parseProductImportFile: async (file, options) => {
        state.parses++;
        return parser.parseProductImportFile(file, options);
      },
    },
    "@/features/admin/stock-import": stock,
    "@/lib/auth/dal": {
      requireAdminSession: async () => ({ userId: "actor", roleCode: role }),
    },
    "@/lib/auth/roles": roles,
    "@/lib/server/stock-pending": {
      saveStockPendingItems: async (_db, items, fileName) => {
        state.pending.push(...items.map((item) => ({ ...item, fileName })));
      },
      pruneStockPendingItems: async () => {},
    },
    "@/lib/server/inventory-reservations": {
      getUnpaidReservedQuantities: async () =>
        new Map(Object.entries(state.reserved ?? {})),
      getInventoryStatusForStock: (quantity) =>
        quantity <= 0 ? "OUT_OF_STOCK" : quantity <= 5 ? "LIMITED" : "IN_STOCK",
    },
    "@/lib/db": {
      hasDatabaseUrl: () => database,
      getDb: () => ({
        product: {
          findMany: async () => {
            state.reads++;
            return state.products;
          },
          updateMany: (query) => ({ query }),
        },
        $transaction: async (updates) => {
          state.batches++;
          if (fail || state.batches === failBatch)
            throw new Error("DB unavailable");
          return updates.map(({ query }) => {
            state.writes.push(query);
            const current = state.products.find((p) => p.id === query.where.id);
            if (
              conflict ||
              !current ||
              current.updatedAt.getTime() !== query.where.updatedAt.getTime()
            )
              return { count: 0 };
            Object.assign(current, query.data, {
              updatedAt: new Date(current.updatedAt.getTime() + 1000),
            });
            return { count: 1 };
          });
        },
      }),
    },
  }).processStockImportAction;
  function data(
    intent = "preview",
    fingerprint,
    mode = "all",
    file = excel([
      ["Артикул", "Цена", "Остаток"],
      [sku, 100, 2],
    ]),
  ) {
    const form = new FormData();
    form.set("stockFile", file);
    form.set("mode", mode);
    form.set("intent", intent);
    if (fingerprint) form.set("fingerprint", fingerprint);
    return form;
  }
  return { action, state, data };
}
test("daily action previews and applies accounting report without changing catalog prices", async () => {
  const { action, state, data } = actionFixture();
  state.products.push(product({ id: "edge", name: "Кромка", sku: "edge" }));
  const file = accountingReport();
  const preview = await action(data("preview", undefined, "all", file));
  assert.equal(preview.counts.ready, 2);
  assert.equal(preview.counts.skipped, 1);
  assert.equal(state.writes.length, 0);
  assert.equal(preview.pendingCount, 1);
  assert.equal(state.pending.length, 0, "preview never saves the list");
  const apply = data("apply", preview.fingerprint, "all", file);
  apply.set(
    "selectedRows",
    JSON.stringify(
      preview.reconciliation
        .filter((entry) => entry.selectable)
        .map((entry) => entry.key),
    ),
  );
  const done = await action(apply);
  assert.equal(done.counts.updated, 2);
  assert.equal(state.writes.length, 2);
  assert.deepEqual(state.writes[0].data, {
    stockQuantity: 2,
    inventoryStatus: "LIMITED",
  });
  assert.deepEqual(state.writes[1].data, { stockQuantity: 127 });
  assert.equal(state.products[0].price, 120);
  assert.equal(state.products[0].compareAtPrice, 150);
  assert.deepEqual(state.pending, [
    {
      matchKey: "name:неизвестный товар",
      sku: null,
      name: "Неизвестный товар",
      unit: "шт",
      quantity: 1,
      fileName: "stock.xlsx",
    },
  ]);
});

test("report rows missing on the site can be saved without selecting stock updates", async () => {
  const { action, state, data } = actionFixture();
  const file = accountingReport();
  const preview = await action(data("preview", undefined, "stock", file));
  const apply = data("apply", preview.fingerprint, "stock", file);
  apply.set("selectedRows", "[]");
  const done = await action(apply);
  assert.equal(done.phase, "done");
  assert.equal(state.writes.length, 0);
  assert.deepEqual(
    state.pending.map((item) => item.name),
    ["Кромка", "Неизвестный товар"],
  );
});

test("pending list keys deduplicate by SKU, else by normalized name, and match new products", () => {
  const entry = (overrides) => ({
    key: "k",
    sku: "",
    name: "",
    siteQuantity: null,
    fileQuantity: 5,
    unit: "шт",
    difference: null,
    kind: "notFound",
    match: null,
    status: "skipped",
    reason: "",
    selectable: false,
    ...overrides,
  });
  const items = stock.collectStockPendingItems([
    entry({ sku: " 160001112 ", name: "ABS кромка" }),
    entry({ sku: "160001112", name: "ABS кромка (склад 2)" }),
    entry({ name: "Деревянный  дюбель" }),
    entry({ name: "деревянный дюбель" }),
    entry({ name: "Петля", kind: "difference" }),
    entry({ name: "Пропавший", kind: "missing" }),
  ]);
  assert.deepEqual(
    items.map((item) => item.matchKey),
    ["sku:160001112", "name:деревянный дюбель"],
  );
  assert.equal(items[0].sku, "160001112");
  const keys = stock.stockPendingCatalogKeys([
    { sku: "160001112", name: "Кромка ABS серая" },
    { sku: "art-1", name: "Деревянный дюбель" },
  ]);
  assert.ok(items.every((item) => keys.has(item.matchKey)));
});

test("pending list Excel opens in the full product import with name, SKU and whole stock", async () => {
  const exporter = loadAction("../features/admin/stock-pending-export.ts", {
    xlsx: XLSX,
  });
  const bytes = exporter.createStockPendingExport([
    { sku: "0160001112", name: "ABS кромка", unit: "пог. м", quantity: 81.5 },
    { sku: null, name: "Деревянный дюбель", unit: "шт", quantity: 17286 },
  ]);
  const parsed = await parser.parseProductImportFile(
    new File([bytes], "pending.xlsx"),
  );
  assert.deepEqual(
    parsed.rows.map((row) => [row.sku, row.name, row.stockQuantity]),
    [
      ["0160001112", "ABS кромка", 81],
      ["", "Деревянный дюбель", 17286],
    ],
  );
  assert.equal(
    parsed.mappedColumns.some((column) => column.source === "Ед. изм. в 1С"),
    false,
  );
});

test("preview never writes; apply requires matching preview, updates only approved fields and revalidates", async () => {
  const { action, state, data } = actionFixture();
  const file = excel([
    ["Артикул", "Цена", "Остаток"],
    [sku, 100, 2],
  ]);
  const preview = await action(data("preview", undefined, "all", file));
  assert.equal(preview.phase, "preview");
  assert.equal(preview.counts.ready, 1);
  assert.equal(state.writes.length, 0);
  assert.equal(state.invalidations.length, 0);
  assert.equal("productId" in preview.entries[0], false);
  const done = await action(data("apply", preview.fingerprint, "all", file));
  assert.equal(done.phase, "done");
  assert.equal(done.counts.updated, 1);
  assert.deepEqual(state.writes[0].data, {
    price: 100,
    stockQuantity: 2,
    inventoryStatus: "LIMITED",
  });
  assert.ok(state.invalidations.some(([path]) => path === "/catalog"));
  const repeat = await action(data("apply", preview.fingerprint, "all", file));
  assert.equal(repeat.phase, "preview");
  assert.equal(state.writes.length, 1);
});
test("missing or stale preview, changed file, mode and catalog require fresh confirmation", async () => {
  for (const change of ["missing", "file", "mode", "catalog"]) {
    const { action, state, data } = actionFixture();
    const file = excel([
      ["Артикул", "Цена"],
      [sku, 100],
    ]);
    const preview = await action(data("preview", undefined, "all", file));
    if (change === "catalog")
      state.products[0].updatedAt = new Date("2026-02-01");
    const result = await action(
      data(
        "apply",
        change === "missing" ? undefined : preview.fingerprint,
        change === "mode" ? "price" : "all",
        change === "file"
          ? excel([
              ["Артикул", "Цена"],
              [sku, 80],
            ])
          : file,
      ),
    );
    assert.equal(result.phase, "preview");
    assert.equal(state.writes.length, 0);
  }
});
test("unauthorized roles are rejected before parsing or database reads", async () => {
  for (const role of [
    "CUSTOMER",
    "DEALER",
    "CUTTING_MANAGER",
    "PRODUCTION_MANAGER",
    "PRODUCTION_OPERATOR",
  ]) {
    const { action, state, data } = actionFixture({ role });
    assert.equal((await action(data())).phase, "error");
    assert.equal(state.reads, 0);
    assert.equal(state.parses, 0);
  }
});
test("missing DB and invalid file/mode/intent return errors without writes", async () => {
  const unavailable = actionFixture({ database: false });
  assert.equal((await unavailable.action(unavailable.data())).phase, "error");
  const { action, state, data } = actionFixture();
  for (const input of [
    new FormData(),
    data("delete"),
    data("preview", undefined, "bad"),
    data("preview", undefined, "all", new File(["foo"], "bad.pdf")),
  ]) {
    assert.equal((await action(input)).phase, "error");
  }
  assert.equal(state.writes.length, 0);
});
test("concurrent writes and database errors produce honest result reports", async () => {
  for (const options of [{ conflict: true }, { fail: true }]) {
    const { action, state, data } = actionFixture(options);
    const file = excel([
      ["Артикул", "Цена"],
      [sku, 10],
    ]);
    const preview = await action(data("preview", undefined, "all", file));
    const done = await action(data("apply", preview.fingerprint, "all", file));
    assert.equal(done.counts.updated, 0);
    assert.equal(done.counts[options.conflict ? "conflict" : "error"], 1);
    assert.equal(state.invalidations.length, 0);
    assert.deepEqual(done.entries[0].changes, {});
  }
});

test("large imports cap the preview but report every row and partial batch failures", async () => {
  const { action, state, data } = actionFixture({ failBatch: 2 });
  state.products = Array.from({ length: 205 }, (_, index) =>
    product({ id: `p${index}`, sku: `SKU-${index}` }),
  );
  const file = excel([
    ["Артикул", "Цена"],
    ...state.products.map((item) => [item.sku, 10]),
  ]);
  const preview = await action(data("preview", undefined, "price", file));
  assert.equal(preview.entries.length, 100);
  assert.equal(preview.total, 205);
  assert.equal(preview.counts.ready, 205);
  assert.equal(preview.reportCsv.split("\r\n").length, 206);
  const done = await action(data("apply", preview.fingerprint, "price", file));
  assert.equal(state.batches, 3);
  assert.equal(done.counts.updated, 105);
  assert.equal(done.counts.error, 100);
  assert.equal(done.entries[0].status, "error");
  assert.equal(done.reportCsv.split("\r\n").length, 206);
});

test("catalog managers and admins can preview without writes", async () => {
  for (const role of ["MANAGER", "ADMIN", "SUPER_ADMIN"]) {
    const { action, state, data } = actionFixture({ role });
    assert.equal((await action(data())).phase, "preview");
    assert.equal(state.writes.length, 0);
  }
});

test("reconciliation includes missing catalog items and shows exact fractional file quantities that are saved rounded down", async () => {
  const { action, state, data } = actionFixture();
  state.products.push(
    product({ id: "edge", name: "Кромка", sku: "EDGE" }),
    product({ id: "absent", sku: "ABSENT", name: "Нет в файле" }),
  );
  const result = await action(
    data("preview", undefined, "stock", accountingReport()),
  );
  const entries = result.reconciliation;
  assert.equal(entries.length, 4);
  const edge = entries.find((entry) => entry.sku === "EDGE");
  assert.equal(edge.fileQuantity, 127.1);
  assert.equal(edge.unit, "пог. м");
  assert.equal(edge.kind, "difference");
  assert.equal(edge.selectable, true);
  assert.match(edge.reason, /округлён вниз/);
  assert.equal(
    entries.find((entry) => entry.kind === "notFound").fileQuantity,
    1,
  );
  const absent = entries.find((entry) => entry.kind === "missing");
  assert.equal(absent.fileQuantity, null);
  assert.equal(absent.difference, null);
  assert.equal(absent.selectable, false);
  assert.match(result.reportCsv, /127.1/);
  assert.match(result.reportCsv, /ABSENT/);
  assert.equal(state.writes.length, 0);
});

test("ambiguous names are review rows, not missing rows, and unknown SKU never falls back to name", async () => {
  const parsed = await parser.parseProductImportFile(
    excel([
      ["Название", "Остаток"],
      ["Петля тестовая", 2],
    ]),
  );
  const products = [product(), product({ id: "other", sku: "OTHER" })];
  const entries = stock.buildStockReconciliation(
    parsed.rows,
    products,
    stock.buildStockImportPlan(parsed.rows, products, "stock"),
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, "review");
  assert.equal(entries[0].selectable, false);
  parsed.rows[0].sku = "UNKNOWN";
  const unknown = stock.buildStockReconciliation(
    parsed.rows,
    products,
    stock.buildStockImportPlan(parsed.rows, products, "stock"),
  );
  assert.equal(unknown[0].kind, "notFound");
  assert.equal(unknown.filter((entry) => entry.kind === "missing").length, 2);
});

test("stock reconciliation returns all rows beyond the legacy sample and isolates price changes", async () => {
  const { action, state, data } = actionFixture();
  state.products = Array.from({ length: 205 }, (_, index) =>
    product({ id: `p${index}`, sku: `SKU-${index}` }),
  );
  const file = excel([
    ["Артикул", "Остаток", "Цена"],
    ...state.products.map((item) => [item.sku, 2, 9999]),
  ]);
  const preview = await action(data("preview", undefined, "stock", file));
  assert.equal(preview.reconciliation.length, 205);
  const apply = data("apply", preview.fingerprint, "stock", file);
  apply.set("selectedRows", JSON.stringify([preview.reconciliation[204].key]));
  const done = await action(apply);
  assert.equal(done.counts.updated, 1);
  assert.equal(done.counts.skipped, 204);
  assert.equal(state.writes[0].where.id, "p204");
  assert.equal("price" in state.writes[0].data, false);
  assert.equal(state.products[204].price, 120);
});

test("stock apply rejects empty, malformed, unknown, missing and unsafe selection before any writes", async () => {
  // "[]" is accepted here only because the report has rows missing on the
  // site: they are saved to the pending list (covered above), stock unchanged.
  for (const selection of [undefined, "{}", "broken", '["unknown"]', "[123]"]) {
    const { action, state, data } = actionFixture();
    const file = accountingReport();
    const preview = await action(data("preview", undefined, "stock", file));
    const apply = data("apply", preview.fingerprint, "stock", file);
    if (selection !== undefined) apply.set("selectedRows", selection);
    assert.equal((await action(apply)).phase, "preview");
    assert.equal(state.writes.length, 0);
  }
  const { action, state, data } = actionFixture();
  state.products.push(product({ id: "edge", sku: "EDGE", name: "Кромка" }));
  const file = accountingReport();
  const preview = await action(data("preview", undefined, "stock", file));
  const apply = data("apply", preview.fingerprint, "stock", file);
  apply.set(
    "selectedRows",
    JSON.stringify(preview.reconciliation.map((entry) => entry.key)),
  );
  assert.equal((await action(apply)).phase, "preview");
  assert.equal(state.writes.length, 0);
});

test("empty selection is rejected when every report row is on the site", async () => {
  const { action, state, data } = actionFixture();
  const file = excel([
    ["Артикул", "Остаток"],
    [sku, 2],
  ]);
  const preview = await action(data("preview", undefined, "stock", file));
  assert.equal(preview.pendingCount, 0);
  const apply = data("apply", preview.fingerprint, "stock", file);
  apply.set("selectedRows", "[]");
  assert.equal((await action(apply)).phase, "preview");
  assert.equal(state.writes.length, 0);
  assert.equal(state.pending.length, 0);
});

test("selected stock rows still require an up-to-date fingerprint", async () => {
  const { action, state, data } = actionFixture();
  const preview = await action(data("preview", undefined, "stock"));
  const apply = data("apply", preview.fingerprint, "stock");
  apply.set(
    "selectedRows",
    JSON.stringify(
      preview.reconciliation
        .filter((entry) => entry.selectable)
        .map((entry) => entry.key),
    ),
  );
  state.products[0].updatedAt = new Date("2026-03-01");
  assert.equal((await action(apply)).phase, "preview");
  assert.equal(state.writes.length, 0);
});
