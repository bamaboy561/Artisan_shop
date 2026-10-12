import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as XLSX from "xlsx";
import enums from "../generated/prisma/index.js";
import { loadAction } from "./load-action.mjs";

const model = loadAction("../features/admin/sales-invoice-model.ts", {});
const parser = loadAction("../features/admin/sales-invoice.ts", {
  xlsx: XLSX,
  "@/features/admin/sales-invoice-model": model,
});
const roles = loadAction("../lib/auth/roles.ts", {
  "@/generated/prisma": enums,
});
function invoiceFile({
  quantity = 6,
  price = 3150,
  sku,
  bookType = "xls",
} = {}) {
  const rows = Array.from({ length: 18 }, () => []);
  rows[2][0] = "Накладная на реализацию № 23566";
  rows[8][0] = "Покупатель:";
  rows[8][4] = "Тестовый покупатель";
  rows[10][0] = "№";
  rows[10][2] = "Товар";
  rows[10][21] = "Количество";
  rows[10][31] = "Цена";
  rows[10][39] = "Сумма";
  if (sku !== undefined) rows[10][3] = "Артикул";
  rows[11][0] = "1";
  rows[11][2] = "Плита тестовая";
  rows[11][21] = quantity;
  rows[11][29] = "шт";
  rows[11][31] = price;
  rows[11][39] = 22050;
  if (sku !== undefined) rows[11][3] = sku;
  rows[15][35] = "Всего:";
  rows[15][39] = 22050;
  rows[17][38] = "К оплате:";
  rows[17][39] = 22050;
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!merges"] = [{ s: { r: 11, c: 2 }, e: { r: 11, c: 20 } }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Лист_1");
  return new File(
    [XLSX.write(workbook, { type: "buffer", bookType })],
    `invoice.${bookType}`,
  );
}
const product = {
  id: "p1",
  sku: "00123-45678901234567890",
  name: "Плита тестовая",
  price: 9999,
  stockQuantity: 20,
  brand: null,
  category: { name: "Плиты" },
  images: [],
};

test("printed XLS and XLSX layouts parse merged names, raw quantities, prices, buyer and totals without inventing corrections", async () => {
  for (const bookType of ["xls", "xlsx"]) {
    const invoice = await parser.parseSalesInvoice(invoiceFile({ bookType }));
    assert.equal(invoice.lines.length, 1);
    assert.equal(invoice.lines[0].quantity, 6);
    assert.equal(invoice.lines[0].unitPrice, 3150);
    assert.equal(invoice.lines[0].amount, 22050);
    assert.equal(invoice.lines[0].unit, "шт");
    assert.equal(invoice.declaredTotal, 22050);
    assert.equal(invoice.customerName, "Тестовый покупатель");
    assert.equal(6 * invoice.lines[0].unitPrice, 18900);
  }
});
test("exact matching preserves long and leading-zero SKUs, rejects ambiguous names and never guesses unknown SKUs", async () => {
  let invoice = await parser.parseSalesInvoice(
    invoiceFile({ sku: product.sku }),
  );
  assert.equal(
    model.matchInvoiceLines(invoice.lines, [product])[0].product.id,
    "p1",
  );
  invoice.lines[0].sku = "unknown";
  assert.equal(
    model.matchInvoiceLines(invoice.lines, [product])[0].product,
    null,
  );
  invoice.lines[0].sku = "";
  assert.equal(
    model.matchInvoiceLines(invoice.lines, [
      product,
      { ...product, id: "other" },
    ])[0].product,
    null,
  );
});
test("missing tables fail; fractional quantities and prices remain visible but cannot be saved", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Текст"]]),
    "Лист",
  );
  await assert.rejects(
    parser.parseSalesInvoice(
      new File(
        [XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })],
        "empty.xlsx",
      ),
    ),
    /Не найдена/,
  );
  const invoice = await parser.parseSalesInvoice(
    invoiceFile({ quantity: 2.5, price: 15.5 }),
  );
  assert.equal(invoice.lines[0].quantity, 2.5);
  assert.equal(invoice.lines[0].unitPrice, 15.5);
  assert.ok(model.validateInvoiceLine(invoice.lines[0]));
  assert.ok(model.validateInvoiceLine({ quantity: 1, unitPrice: 15.5 }));
});
test("server item inputs reject malformed, fractional, overflowing, duplicate and empty values instead of clamping", () => {
  for (const [ids, qty, prices] of [
    [["p"], ["2.5"], ["3150"]],
    [["p"], ["0"], ["3150"]],
    [["p"], ["1000"], ["3150"]],
    [["p"], ["2"], ["-1"]],
    [["p"], ["2"], ["15.5"]],
    [["p"], ["2"], ["NaN"]],
    [["p"], ["2"], ["2147483647"]],
    [
      ["p", "p"],
      ["2", "3"],
      ["1", "1"],
    ],
    [[""], ["2"], ["3"]],
  ])
    assert.throws(() => model.parseSalesItemInputs(ids, qty, prices));
  assert.deepEqual(model.parseSalesItemInputs(["p"], ["6"], ["3150"]), [
    { productId: "p", quantity: 6, invoicePrice: 3150 },
  ]);
  assert.equal(
    model.parseSalesItemInputs(["p"], ["6"], [""])[0].invoicePrice,
    null,
  );
  assert.equal(
    model.parseSalesItemInputs(["p"], ["6"], ["0"])[0].invoicePrice,
    0,
  );
});
test("preview checks roles before reading and matches against the full catalog without any writes", async () => {
  for (const role of [
    "CUSTOMER",
    "CUTTING_MANAGER",
    "MANAGER",
    "SUPER_ADMIN",
  ]) {
    let reads = 0;
    const { previewSalesInvoiceAction } = loadAction(
      "../app/admin/sales-floor/invoice-actions.ts",
      {
        "@/features/admin/sales-invoice": parser,
        "@/features/admin/sales-invoice-model": model,
        "@/lib/auth/dal": {
          requireAdminSession: async () => ({ roleCode: role }),
        },
        "@/lib/auth/roles": roles,
        "@/lib/db": { hasDatabaseUrl: () => true },
        "@/lib/server/invoice-photo": {
          InvoicePhotoError: class extends Error {},
        },
        "@/lib/server/invoice-photo-limit": {},
        "@/lib/server/sales-floor": {
          getSalesFloorProducts: async (query, take, all) => {
            reads++;
            assert.equal(all, true);
            return [product];
          },
        },
      },
    );
    const data = new FormData();
    data.set("invoice", invoiceFile());
    const result = await previewSalesInvoiceAction(data);
    if (["MANAGER", "SUPER_ADMIN"].includes(role)) {
      assert.equal(reads, 1);
      assert.equal(result.invoice.lines[0].product.id, product.id);
    } else {
      assert.equal(reads, 0);
      assert.ok(result.error);
    }
  }
});

// Isolate the actual declaration with TypeScript's AST; every external operation is stubbed.
function saleFixture({ stock = 20, missing = false } = {}) {
  const source = ts.createSourceFile(
    "actions.ts",
    readFileSync(new URL("../app/admin/actions.ts", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "createSalesFloorOrderAction",
  );
  const state = {
    orders: [],
    notifications: [],
    loyalty: [],
    bases: [],
    reserves: [],
    catalog: { ...product, stockQuantity: stock },
  };
  class StockError extends Error {}
  const tx = {
    order: {
      create: async ({ data }) => {
        state.orders.push(data);
        return { id: "order1", number: "H1", createdAt: new Date() };
      },
    },
    siteSetting: { create: async () => ({}) },
  };
  const deps = {
    ...enums,
    ...model,
    PROMOTION_PRICE_SELECT: {},
    hasDatabaseUrl: () => true,
    ensureAdminAccess: async () => ({
      userId: "manager",
      firstName: "Manager",
      lastName: null,
      email: "manager@test",
    }),
    getString: (data, key) => String(data.get(key) ?? ""),
    getOptionalString: (data, key) => data.get(key) || null,
    getOptionalInt: (data, key) => Number(data.get(key) ?? 0),
    redirect: (url) => {
      throw new Error(`REDIRECT:${url}`);
    },
    ensureProductBundleItemsTable: async () => {},
    getDb: () => ({
      order: { findUnique: async () => null },
      siteSetting: { findUnique: async () => null },
      user: {
        findFirst: async () => ({
          id: "customer",
          firstName: "Client",
          email: "client@test",
          loyaltyPointsBalance: 1000,
        }),
      },
      product: {
        findMany: async () =>
          missing
            ? []
            : [
                {
                  ...state.catalog,
                  promotions: [],
                  category: { kind: "PLATE", promotions: [] },
                },
              ],
      },
      $transaction: async (callback) => callback(tx),
    }),
    getLoyaltyProgramConfig: async () => ({}),
    getEffectiveDiscountPercent: () => 0,
    getEffectiveProductPrice: (item) => item.price,
    getProductPromotionPrice: (price) => ({ unitDiscountAmount: price * 0.1 }),
    getRedeemableLoyaltyPoints: () => 0,
    estimateLoyaltyPointsForLines: (lines) => {
      state.bases.push(lines);
      return 10;
    },
    buildAdminOrderNumber: () => "H1",
    reserveInventoryItems: async (client, lines) => {
      state.reserves.push(lines);
      if (lines[0].quantity > stock) throw new StockError();
    },
    applyApprovedLoyaltyDelta: async (client, delta) => {
      state.loyalty.push(delta);
    },
    InventoryAvailabilityError: StockError,
    InsufficientLoyaltyBalanceError: class extends Error {},
    logOperationEvent: async () => {},
    handleOrderCreated: async (order) => {
      state.notifications.push(order);
    },
    revalidateAdminOperations: () => {},
    revalidateAdminUsers: () => {},
  };
  const output = ts.transpileModule(declaration.getText(source), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function(...Object.keys(deps), "module", "exports", output)(
    ...Object.values(deps),
    loaded,
    loaded.exports,
  );
  const data = new FormData();
  data.set("customerId", "customer");
  data.set("productId", "p1");
  data.set("quantity", "6");
  data.set("itemUnitPrice", "3150");
  data.set("invoiceReference", "23566");
  data.set("accrueLoyalty", "on");
  return { action: loaded.exports.createSalesFloorOrderAction, state, data };
}
test("actual sale action stores invoice prices, skips repeat promotions, bases bonuses and notifications on invoice total without touching catalog prices", async () => {
  const { action, state, data } = saleFixture();
  await assert.rejects(action(data), /REDIRECT:\/admin\/orders\/order1/);
  const order = state.orders[0];
  assert.equal(order.items.create[0].unitPrice, 3150);
  assert.equal(order.discountTotal, 0);
  assert.equal(order.total, 18900);
  assert.equal(state.bases[0][0].total, 18900);
  assert.equal(state.notifications[0].items[0].unitPrice, 3150);
  assert.match(order.comment, /23566/);
  assert.equal(state.catalog.price, 9999);
  assert.equal(state.loyalty.length, 1);
});
test("ordinary manual sales keep catalog promotion pricing", async () => {
  const { action, state, data } = saleFixture();
  data.set("itemUnitPrice", "");
  await assert.rejects(action(data), /REDIRECT:\/admin\/orders/);
  assert.equal(state.orders[0].items.create[0].unitPrice, 9999);
  assert.equal(state.orders[0].discountTotal, 9999 * 0.1 * 6);
});
test("stock, missing products and invalid invoice values fail before sale, points or notifications", async () => {
  for (const options of [{ stock: 2 }, { missing: true }, {}]) {
    const { action, state, data } = saleFixture(options);
    if (!Object.keys(options).length) data.set("itemUnitPrice", "-1");
    await assert.rejects(action(data), /REDIRECT:\/admin\/sales-floor\?error=/);
    assert.equal(state.orders.length, 0);
    assert.equal(state.loyalty.length, 0);
    assert.equal(state.notifications.length, 0);
  }
});
