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
test("unknown SKU falls back to the same name on the site", async () => {
  const [row] = await plan([
    ["Артикул", "Название", "Цена"],
    ["missing", product().name, 10],
  ]);
  assert.equal(row.status, "ready");
  assert.equal(row.productId, "p1");
  assert.equal(row.match, "name");
  assert.match(row.reason, /Артикул missing не найден/);
});
test("loose SKU, SKU inside the site name and similar names update existing products", async () => {
  const catalog = [
    product({
      id: "edge",
      sku: "edge-auto",
      name: "Кромка ABS 0651 Ar Bergen 1,0 (160001112)",
    }),
    product({
      id: "lsp",
      sku: "LSP-00042",
      name: "ЛДСП Egger Дуб Галифакс 16 мм",
    }),
    product({
      id: "lsp18",
      sku: "LSP-00043",
      name: "ЛДСП Egger Дуб Галифакс 18 мм",
    }),
    product({
      id: "hinge",
      sku: "WQ",
      name: "Петля накладная Blum Clip Top 110",
    }),
  ];
  const rows = await plan(
    [
      ["Артикул", "Название", "Остаток"],
      ["160001112", "Кромка АВS/0651 Bergen", 7],
      ["lsp 42", "ЛДСП Дуб Галифакс", 3],
      ["", "ЛДСП  EGGER дуб Галифакс 18мм", 4],
      ["", "WQ9WE71406-02 Петля накладня BLUM Clip-Top 110", 9],
      ["", "Петля Blum Clip Top накладная 95", 9],
    ],
    catalog,
    "stock",
  );
  assert.deepEqual(
    rows.map((row) => [row.productId, row.match]),
    [
      ["edge", "sku"],
      ["lsp", "sku"],
      ["lsp18", "similar"],
      ["hinge", "similar"],
      [null, null],
    ],
  );
  assert.match(rows[2].reason, /Похожее название в файле/);
});
test("names that differ by a colour, variant letter or extra word are not merged", () => {
  for (const [left, right] of [
    [
      "WQ9WE71406-02 Дуб Кэсл темный 1*22мм",
      "WQ9WE71406 Дуб Кэсл светлый 1*22мм",
    ],
    ["Кромка Китай 1*19", "Кромка Китай"],
    ["INDO-В 134 КМБР", "INDO 134 КМБР"],
    ["Плинтус Арбитон", "Плинтус Арбитон (распродажа)"],
    ["Кромка ПВХ Серый Графит 19/1", "Кромка ПВХ Серый Апельсин 19/1"],
    [
      "ARTOS AKS:192MM РУЧКА ЧЕРНЫЙ МАТОВЫЙ",
      "ARTOS AKS:320MM РУЧКА ЧЕРНЫЙ МАТОВЫЙ",
    ],
    [
      "Кромка ABS M.101.S01 Белый снежный 19*0,8",
      "Кромка ABS M.101.T01 Белый снежный 19*0,8",
    ],
  ])
    assert.equal(stock.stockNamesSimilar(left, right), false, left);
  assert.equal(
    stock.stockNamesSimilar("Кромка ABS СЛОТЕКС-МК", "кромка  abs слотекс-мк"),
    true,
  );
  assert.equal(
    stock.stockNamesSimilar(
      "Меренга 1*22мм WQ63853M",
      "WQ63853M Меренга 1*22мм",
    ),
    true,
  );
  assert.equal(
    stock.stockNamesSimilar("Меренга 1*22мм", "WQ63853М Меренга 1*22мм"),
    true,
  );
});
test("similar name never steals a product matched exactly by another row", async () => {
  const rows = await plan(
    [
      ["Название", "Остаток"],
      ["Петля тестовая", 3],
      ["Петля тестовая большая", 4],
    ],
    [product()],
    "stock",
  );
  assert.equal(rows[0].productId, "p1");
  assert.equal(rows[0].status, "ready");
  assert.equal(rows[1].productId, null);
});
test("rows matched on the site are removed from the pending list", async () => {
  const parsed = await parser.parseProductImportFile(
    excel([
      ["Артикул", "Название", "Остаток"],
      ["160001112", "Петля тестовая", 2],
    ]),
  );
  const rows = stock.buildStockImportPlan(parsed.rows, [product()], "stock");
  const keys = stock.stockMatchedPendingKeys(parsed.rows, rows);
  assert.ok(keys.has(stock.stockPendingKey({ sku: "160001112", name: "x" })));
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
    deletes: [],
  };
  const actions = loadAction("../app/admin/products/stock-import-actions.ts", {
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
      getStockLinks: async () => state.links ?? new Map(),
      saveStockLinks: async (_db, links, options) => {
        state.savedLinks = [
          ...(state.savedLinks ?? []),
          ...links.map((link) => ({ ...link, ...options })),
        ];
        return links.map((link) => ({
          matchKey: link.matchKey,
          previous: null,
        }));
      },
    },
    "@/lib/server/stock-history": {
      recordStockImport: async (_db, log) => {
        state.logs = [...(state.logs ?? []), log];
        return { id: `log${state.logs.length}` };
      },
      attachStockImportLinks: async () => {},
      undoStockImport: async () => null,
    },
    "@/lib/server/stock-pending-schema": {
      ensureStockPendingItemsTable: async () => {},
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
        stockPendingItem: {
          deleteMany: async (args) => {
            state.deletes.push(args);
            return { count: 0 };
          },
        },
        $transaction: async (updates) => {
          state.batches++;
          if (fail || state.batches === failBatch)
            throw new Error("DB unavailable");
          // Имитация параллельного изменения между проверкой и записью.
          state.beforeWrite?.();
          state.beforeWrite = null;
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
  });
  const action = actions.processStockImportAction;
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
  return { action, state, data, actions };
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
      note: null,
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
    entry({ name: "Ручка", fileQuantity: 3 }),
    entry({ name: "Петля", kind: "difference" }),
    entry({ name: "Пропавший", kind: "missing" }),
  ]);
  assert.deepEqual(
    items.map((item) => [item.matchKey, item.sku, item.quantity, item.note]),
    [
      ["sku:160001112", "160001112", 5, null],
      ["name:ручка", null, 3, null],
    ],
  );
  const keys = stock.stockPendingCatalogKeys([
    { sku: "160001112", name: "Кромка ABS серая" },
    { sku: "art-1", name: "Ручка" },
  ]);
  assert.ok(items.every((item) => keys.has(item.matchKey)));
});

test("pending list never picks one of repeated rows silently", () => {
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
    // Один артикул у разных позиций (так бывает в отчёте 1С).
    entry({ sku: "12282001", name: "Провод LED 1,5 м", fileQuantity: 994 }),
    entry({ sku: "12282001", name: "Провод Nuomi 2 м", fileQuantity: 977 }),
    // Одна и та же позиция дважды.
    entry({ name: "Деревянный  дюбель", fileQuantity: 10 }),
    entry({ name: "деревянный дюбель", fileQuantity: 20 }),
  ]);
  assert.deepEqual(
    items.map((item) => [item.matchKey, item.quantity, Boolean(item.note)]),
    [
      ["sku:12282001|name:провод led 1,5 м", 994, true],
      ["sku:12282001|name:провод nuomi 2 м", 977, true],
      ["name:деревянный дюбель", null, true],
    ],
  );
  const keys = stock.stockPendingCatalogKeys([
    { sku: "12282001", name: "Провод LED 1,5 м" },
  ]);
  assert.ok(keys.has(items[0].matchKey));
  assert.ok(!keys.has(items[1].matchKey));
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

test("ambiguous names are review rows, not missing rows, also when the SKU is unknown", async () => {
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
  assert.equal(unknown[0].kind, "review");
  assert.equal(unknown.filter((entry) => entry.kind === "missing").length, 0);
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

test("stock pending table is created once at runtime", async () => {
  const schema = loadAction("../lib/server/stock-pending-schema.ts", {});
  const statements = [];
  const db = {
    $executeRawUnsafe: async (sql) => {
      statements.push(sql);
    },
  };
  await schema.ensureStockPendingItemsTable(db);
  await schema.ensureStockPendingItemsTable(db);
  assert.equal(statements.length, 9);
  assert.match(statements[4], /CREATE TABLE IF NOT EXISTS "StockLink"/);
  assert.match(statements[7], /CREATE TABLE IF NOT EXISTS "StockImportLog"/);
  assert.match(statements[3], /ADD COLUMN IF NOT EXISTS "linkedProductId"/);
  assert.match(statements[0], /CREATE TABLE IF NOT EXISTS "StockPendingItem"/);
  assert.match(
    statements[1],
    /UNIQUE INDEX IF NOT EXISTS "StockPendingItem_matchKey_key"/,
  );
});

test("stock pending table creation retries a concurrent create failure", async () => {
  const schema = loadAction("../lib/server/stock-pending-schema.ts", {});
  let calls = 0;
  const db = {
    $executeRawUnsafe: async () => {
      calls += 1;
      if (calls === 1)
        throw new Error("duplicate key pg_type_typname_nsp_index");
    },
  };
  await Promise.all([
    schema.ensureStockPendingItemsTable(db),
    schema.ensureStockPendingItemsTable(db),
  ]);
  assert.equal(calls, 10);
});

test("ambiguous similar candidates are never listed as missing from the file", async () => {
  const parsed = await parser.parseProductImportFile(
    excel([
      ["Название", "Остаток"],
      ["WQ63853M Меренга 1*22мм", 5],
    ]),
  );
  const products = [
    product({ id: "a", sku: "A", name: "Меренга 1*22мм" }),
    product({ id: "b", sku: "B", name: "меренга 1*22 мм" }),
  ];
  const entries = stock.buildStockReconciliation(
    parsed.rows,
    products,
    stock.buildStockImportPlan(parsed.rows, products, "stock"),
  );
  assert.deepEqual(
    entries.map((entry) => entry.kind),
    ["review"],
  );
});

test("article written inside the file name matches the site SKU field", async () => {
  const parsed = await parser.parseProductImportFile(
    excel([
      ["Артикул", "Название", "Остаток"],
      ["", "WQ63853M Меренга 1*22мм", 5],
      ["", "Кромка WQ 9WE71406-02 Дуб сонома", 3],
      ["XX-1", "6051606S Петля накладная", 7],
      ["", "Шуруп для 48080140YA", 9],
      ["", "Кромка 2000x22 белая", 4],
      ["", "S-1032- ABS-Медные сумерки/BS/22/1.0", 2],
    ]),
  );
  const products = [
    product({ id: "m", sku: "WQ63853M", name: "Кромка Меренга" }),
    product({ id: "d", sku: "9WE71406-02", name: "Кромка дуб сонома 22мм" }),
    product({ id: "p", sku: "6051606S", name: "Петля Blum" }),
    product({ id: "h", sku: "48080140YA", name: "Ручка рейлинг" }),
    product({ id: "w", sku: "200022", name: "Кромка белая" }),
    product({ id: "s", sku: "S-1032", name: "Кромка ABS медные сумерки" }),
  ];
  const plan = stock.buildStockImportPlan(parsed.rows, products, "stock");
  assert.deepEqual(
    plan.map((entry) => entry.productId ?? null),
    ["m", "d", "p", null, null, "s"],
  );
  assert.match(plan[0].reason, /WQ63853M найден в названии/);
});

test("article in the name stays ambiguous when site SKUs differ only in punctuation", async () => {
  const parsed = await parser.parseProductImportFile(
    excel([
      ["Название", "Остаток"],
      ["AB_001234 Кромка синяя", 5],
    ]),
  );
  const products = [
    product({ id: "a", sku: "AB-01234", name: "Кромка белая" }),
    product({ id: "b", sku: "AB01234", name: "Кромка красная" }),
  ];
  const plan = stock.buildStockImportPlan(parsed.rows, products, "stock");
  assert.equal(plan[0].productId ?? null, null);
  assert.equal(plan[0].ambiguous, true);
});

test("one colour from two suppliers adds up into the single site product", async () => {
  const parsed = await parser.parseProductImportFile(
    excel([
      ["Название", "Остаток"],
      ["PGR4212 Меренга 1*22мм", 800],
      ["WQ63853M Меренга 1*22мм", 2850],
    ]),
  );
  const products = [
    product({ id: "m", sku: "WQ63853M", name: "Меренга 1*22мм" }),
  ];
  const plan = stock.buildStockImportPlan(parsed.rows, products, "stock");
  const merged = plan.find((entry) => entry.status === "ready");
  assert.equal(merged.changes.stockQuantity, 3650);
  assert.match(merged.reason, /Остатки сложены/);
  assert.ok(plan.every((entry) => entry.productId === "m"));
  const entries = stock.buildStockReconciliation(parsed.rows, products, plan);
  assert.ok(entries.every((entry) => entry.kind !== "notFound"));
  assert.equal(entries.find((entry) => entry.selectable).fileQuantity, 3650);
});

test("a link chosen by hand matches the row on later uploads", async () => {
  const parsed = await parser.parseProductImportFile(
    excel([
      ["Артикул", "Название", "Остаток"],
      ["160001112", "ABS/3001/SUPER MATT LIGHT GREY 1*22*0", 1200],
    ]),
  );
  const products = [
    product({ id: "g", sku: "KR-1", name: "Кромка светло-серая матовая" }),
  ];
  const before = stock.buildStockImportPlan(parsed.rows, products, "stock");
  assert.equal(before[0].productId, null);
  const links = new Map([
    [
      stock.stockLinkKey({
        sku: "160001112",
        name: "ABS/3001/SUPER MATT LIGHT GREY 1*22*0",
      }),
      "g",
    ],
  ]);
  const after = stock.buildStockImportPlan(
    parsed.rows,
    products,
    "stock",
    links,
  );
  assert.equal(after[0].productId, "g");
  assert.equal(after[0].match, "linked");
  // Другая позиция 1С с тем же артикулом связь не наследует.
  const other = stock.buildStockImportPlan(
    [{ ...parsed.rows[0], name: "ABS/3002/MATT DARK GREY 1*22*0" }],
    products,
    "stock",
    links,
  );
  assert.equal(other[0].productId, null);
});

test("rows missing on the site get the nearest site product as a suggestion", () => {
  const matcher = stock.createStockMatcher([
    { id: "a", sku: "KR-7", name: "Кромка ABS Дуб Сонома 22 мм" },
    { id: "b", sku: "KR-8", name: "Петля накладная" },
  ]);
  const row = { sku: "", name: "ABS Дуб Сонома светлый 1*22мм" };
  assert.equal(matcher.find(row).product, null);
  assert.deepEqual(
    matcher.suggest(row).map((item) => item.id),
    ["a"],
  );
});

test("«Это он» in the check table links a row, and apply remembers matches and logs changes", async () => {
  const { action, state, data } = actionFixture();
  state.products.push(
    product({
      id: "p2",
      sku: "KR-1",
      name: "Кромка ПВХ белая",
      stockQuantity: 0,
    }),
  );
  const file = accountingReport();
  const first = await action(data("preview", undefined, "stock", file));
  const edge = first.reconciliation.find((entry) => entry.name === "Кромка");
  assert.equal(edge.kind, "notFound");
  assert.ok(edge.linkKey);
  const manualLinks = JSON.stringify({ [edge.linkKey]: "p2" });
  const relinked = data("preview", undefined, "stock", file);
  relinked.set("manualLinks", manualLinks);
  const second = await action(relinked);
  const linked = second.reconciliation.find(
    (entry) => entry.linkKey === edge.linkKey,
  );
  assert.equal(linked.match, "linked");
  assert.equal(linked.selectable, true);

  const apply = data("apply", second.fingerprint, "stock", file);
  apply.set("manualLinks", manualLinks);
  apply.set(
    "selectedRows",
    JSON.stringify(
      second.reconciliation
        .filter((entry) => entry.selectable)
        .map((entry) => entry.key),
    ),
  );
  const done = await action(apply);
  assert.equal(done.phase, "done");
  assert.deepEqual(
    state.savedLinks.map((link) => [link.productId, link.manual]),
    [
      ["p1", false],
      ["p2", true],
    ],
  );
  assert.equal(state.logs.length, 1);
  assert.deepEqual(
    state.logs[0].changes.map((change) => [
      change.productId,
      change.before.stockQuantity,
      change.after.stockQuantity,
    ]),
    [
      ["p1", 8, 2],
      ["p2", 0, 127],
    ],
  );
  // Связь с несуществующим товаром не принимается.
  const forged = data("preview", undefined, "stock", file);
  forged.set("manualLinks", JSON.stringify({ [edge.linkKey]: "missing" }));
  const ignored = await action(forged);
  assert.equal(
    ignored.reconciliation.find((entry) => entry.linkKey === edge.linkKey).kind,
    "notFound",
  );
});

test("exact SKU matches are not remembered, similar ones are once approved", () => {
  const rows = [
    { sku: "A-1", name: "Петля" },
    { sku: "", name: "WQ63853M Меренга 1*22мм" },
  ];
  const plan = [
    { productId: "a", sku: "A-1", match: "sku", status: "updated" },
    { productId: "m", sku: "M", match: "similar", status: "updated" },
  ];
  assert.deepEqual(
    stock.stockLinksToRemember(rows, plan).map((link) => link.productId),
    ["m"],
  );
  assert.deepEqual(
    stock.stockLinksToRemember(
      rows,
      plan.map((entry) => ({ ...entry, status: "skipped" })),
    ),
    [],
  );
});

test("undo restores only products untouched since the import and drops its links", async () => {
  const history = loadAction("../lib/server/stock-history.ts", {
    "@/lib/server/stock-pending-schema": {
      ensureStockPendingItemsTable: async () => {},
    },
  });
  const calls = { updates: [], deletes: [], linkUpdates: [], logUpdate: null };
  const products = {
    a: { stockQuantity: 5, inventoryStatus: "LIMITED" },
    b: { stockQuantity: 9, inventoryStatus: "IN_STOCK" },
  };
  const db = {
    stockImportLog: {
      findUnique: async () => ({
        id: "log1",
        createdAt: new Date("2026-10-15"),
        undoneAt: null,
        changes: [
          {
            productId: "a",
            before: { stockQuantity: 1, inventoryStatus: "LIMITED" },
            after: { stockQuantity: 5, inventoryStatus: "LIMITED" },
          },
          {
            productId: "b",
            before: { stockQuantity: 2, inventoryStatus: "LIMITED" },
            after: { stockQuantity: 7, inventoryStatus: "IN_STOCK" },
          },
        ],
        links: [
          { matchKey: "k", previous: null },
          {
            matchKey: "j",
            previous: { productId: "z", manual: false, importLogId: "log0" },
          },
        ],
      }),
      count: async () => 0,
      update: async (query) => {
        calls.logUpdate = query;
      },
    },
    product: {
      updateMany: (query) => {
        calls.updates.push(query);
        return query;
      },
    },
    stockLink: {
      deleteMany: async (query) => calls.deletes.push(query),
      updateMany: async (query) => calls.linkUpdates.push(query),
    },
    $transaction: async (queries) =>
      queries.map(({ where, data }) => {
        const current = products[where.id];
        const same = Object.entries(where).every(
          ([key, value]) => key === "id" || current[key] === value,
        );
        if (same) Object.assign(current, data);
        return { count: same ? 1 : 0 };
      }),
  };
  const result = await history.undoStockImport(db, "log1");
  assert.deepEqual(result, { restored: 1, skipped: 1, blocked: false });
  assert.equal(products.a.stockQuantity, 1);
  assert.equal(products.b.stockQuantity, 9);
  assert.deepEqual(calls.deletes, [
    { where: { matchKey: "k", importLogId: "log1" } },
  ]);
  assert.deepEqual(calls.linkUpdates, [
    {
      where: { matchKey: "j", importLogId: "log1" },
      data: { productId: "z", manual: false, importLogId: "log0" },
    },
  ]);
  assert.ok(calls.logUpdate.data.undoneAt instanceof Date);
});

test("a manual link is saved even when the product already has the file quantity", async () => {
  const { action, state, data } = actionFixture();
  state.products.push(
    product({ id: "p2", sku: "KR-1", name: "Кромка ПВХ", stockQuantity: 127 }),
  );
  const file = accountingReport();
  const first = await action(data("preview", undefined, "stock", file));
  const edge = first.reconciliation.find((entry) => entry.name === "Кромка");
  const manualLinks = JSON.stringify({ [edge.linkKey]: "p2" });
  const preview = data("preview", undefined, "stock", file);
  preview.set("manualLinks", manualLinks);
  const second = await action(preview);
  const linked = second.reconciliation.find(
    (entry) => entry.linkKey === edge.linkKey,
  );
  assert.equal(linked.kind, "unchanged");
  const apply = data("apply", second.fingerprint, "stock", file);
  apply.set("manualLinks", manualLinks);
  apply.set("selectedRows", "[]");
  const done = await action(apply);
  assert.equal(done.phase, "done");
  assert.deepEqual(
    state.savedLinks.map((link) => [link.productId, link.manual]),
    [["p2", true]],
  );
});

test("zeroing records only products that were actually zeroed", async () => {
  const { action, state, data } = actionFixture();
  state.products.push(
    product({ id: "p2", sku: "X-1", name: "Товар А", stockQuantity: 3 }),
    product({ id: "p3", sku: "X-2", name: "Товар Б", stockQuantity: 4 }),
  );
  const file = accountingReport();
  const preview = data("preview", undefined, "stock", file);
  preview.set("zeroMissing", "on");
  const first = await action(preview);
  // Товар Б кто-то продал, пока шло обнуление.
  state.beforeWrite = () => {
    const item = state.products.find((product) => product.id === "p3");
    item.stockQuantity = 1;
    item.updatedAt = new Date("2026-02-02");
  };
  const apply = data("apply", first.fingerprint, "stock", file);
  apply.set("zeroMissing", "on");
  apply.set("selectedRows", "[]");
  const done = await action(apply);
  assert.equal(done.phase, "done");
  assert.deepEqual(
    state.logs[0].changes.map((change) => change.productId),
    ["p2"],
  );
  assert.equal(
    state.products.find((item) => item.id === "p3").stockQuantity,
    1,
  );
});

test("«Это он» applies straight from the first check: no re-check, linked rows update themselves", async () => {
  const { action, state, data } = actionFixture();
  state.products.push(
    product({ id: "p2", sku: "KR-1", name: "Кромка ПВХ", stockQuantity: 0 }),
  );
  const file = accountingReport();
  const preview = await action(data("preview", undefined, "stock", file));
  const edge = preview.reconciliation.find((entry) => entry.name === "Кромка");
  const apply = data("apply", preview.fingerprint, "stock", file);
  apply.set("manualLinks", JSON.stringify({ [edge.linkKey]: "p2" }));
  apply.set("selectedRows", "[]");
  const done = await action(apply);
  assert.equal(done.phase, "done");
  assert.equal(
    state.products.find((item) => item.id === "p2").stockQuantity,
    127,
  );
  assert.deepEqual(
    state.savedLinks.map((link) => [link.productId, link.manual]),
    [["p2", true]],
  );
});

test("«Это он» with zeroing enabled still applies from the first check", async () => {
  const { action, state, data } = actionFixture();
  // Кромка ПВХ есть на сайте с остатком, в файле она под другим названием:
  // без связи она попала бы в список на обнуление.
  state.products.push(
    product({ id: "p2", sku: "KR-1", name: "Кромка ПВХ", stockQuantity: 5 }),
  );
  const file = accountingReport();
  const preview = data("preview", undefined, "stock", file);
  preview.set("zeroMissing", "on");
  const first = await action(preview);
  const edge = first.reconciliation.find((entry) => entry.name === "Кромка");
  const apply = data("apply", first.fingerprint, "stock", file);
  apply.set("zeroMissing", "on");
  apply.set("selectedRows", "[]");
  apply.set("manualLinks", JSON.stringify({ [edge.linkKey]: "p2" }));
  const done = await action(apply);
  assert.equal(done.phase, "done", done.message);
  assert.equal(
    state.products.find((item) => item.id === "p2").stockQuantity,
    127,
  );
});

test("«Очистить список» removes pending items but keeps dismissed and linked ones", async () => {
  const { state, actions } = actionFixture();
  await actions.clearStockPendingItemsAction();
  assert.deepEqual(state.deletes, [
    { where: { dismissedAt: null, linkedProductId: null } },
  ]);
  assert.deepEqual(state.invalidations, [["/admin/products"]]);
});

test("«Очистить список» does nothing for a cutting manager", async () => {
  const { state, actions } = actionFixture({ role: "CUTTING_MANAGER" });
  await actions.clearStockPendingItemsAction();
  assert.deepEqual(state.deletes, []);
});

test("pending items are saved in bulk upserts, not row by row", async () => {
  const calls = [];
  const { saveStockPendingItems } = loadAction(
    "../lib/server/stock-pending.ts",
    {
      "node:crypto": { randomUUID: () => "id" },
      "@/generated/prisma": {
        Prisma: {
          sql: (strings, ...values) => ({ strings, values }),
          join: (parts) => ({ joined: parts }),
        },
      },
      "@/features/admin/stock-import": stock,
      "@/lib/server/stock-pending-schema": {
        ensureStockPendingItemsTable: async () => {},
      },
    },
  );
  const items = Array.from({ length: 1001 }, (_, index) => ({
    matchKey: `sku:${index}`,
    sku: `S-${index}`,
    name: `Позиция ${index}`,
    unit: "шт",
    quantity: index,
    note: null,
  }));
  // Повтор ключа в одном файле не ломает запрос «ON CONFLICT».
  items.push({ ...items[0] });
  await saveStockPendingItems(
    { $executeRaw: async (strings, ...values) => calls.push(values) },
    items,
    "stock.xlsx",
  );
  assert.deepEqual(
    calls.map((values) => values[0].joined.length),
    [400, 400, 201],
  );
  assert.equal(calls[0][0].joined[0].values[1], "sku:0");
  assert.equal(calls[0][0].joined[0].values[7], "stock.xlsx");
});
