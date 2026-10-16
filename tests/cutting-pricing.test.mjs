import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadAction } from "./load-action.mjs";

const pure = loadAction("../features/cutting/labor-price.ts", {});
const { calculateCuttingLaborTotal: calculate, parseCuttingLaborPrice: parse } =
  pure;
const price = { sheetRate: 300, edgeRate: 25 };
const sitePrices = loadAction("../features/cutting/site-prices.ts", {});

test("labor only: sheet count and fractional edge meters", () => {
  assert.equal(calculate(price, 4, 12.5, "ABS"), 1513);
  assert.equal(calculate(price, 4, 0, "ABS"), 1200);
  assert.equal(calculate(price, 4, null, null), 1200);
});
test("missing quantities never turn into a misleading partial total", () => {
  assert.equal(calculate(price, null, 10), null);
  assert.equal(calculate(price, 3, null, "ABS"), null);
  assert.equal(calculate(price, 3, -1), null);
  assert.equal(calculate(price, 1.5, 10), null);
  assert.equal(calculate(price, 0, 10), null);
});
test("validate rates and round the final total once", () => {
  for (const rate of [-1, NaN, Infinity, 100001, 1.001, "25"])
    assert.equal(parse({ sheetRate: rate, edgeRate: 25 }), null);
  assert.deepEqual(parse({ sheetRate: 0, edgeRate: 0 }), {
    sheetRate: 0,
    edgeRate: 0,
  });
  assert.equal(calculate({ sheetRate: 1.25, edgeRate: 0.15 }, 2, 10), 4);
  assert.throws(() =>
    calculate({ sheetRate: 100000, edgeRate: 100000 }, 10000, 100000),
  );
});

function fixture() {
  const settings = new Map([["cutting:labor-price:v1", price]]);
  const request = {
    id: "r1",
    type: "CUTTING_SERVICE",
    cuttingSheetCount: 4,
    cuttingEdgeMeters: 12.5,
    edgeOption: "ABS",
    quotedTotal: 999,
  };
  const events = [];
  const tx = {
    siteSetting: {
      findUnique: async ({ where }) => ({ value: settings.get(where.key) }),
      upsert: async ({ where, create }) =>
        settings.set(where.key, create.value),
    },
    request: {
      findUnique: async () => ({ ...request }),
      update: async ({ data }) => Object.assign(request, data),
    },
    operationEvent: { create: async ({ data }) => events.push(data) },
  };
  const db = { ...tx, $transaction: async (fn) => fn(tx) };
  const pricing = loadAction("../lib/server/cutting-pricing.ts", {
    "server-only": {},
    react: { cache: (fn) => fn },
    "@/lib/db": { getDb: () => db, hasDatabaseUrl: () => true },
    "@/features/cutting/labor-price": pure,
    "@/features/cutting/site-prices": sitePrices,
  });
  return { settings, request, events, pricing, db };
}

test("explicit recalculation snapshots rates and records actor + old amount", async () => {
  const f = fixture();
  assert.equal(await f.pricing.repriceCuttingRequest("r1", "manager1"), 1513);
  assert.deepEqual(f.settings.get("cutting:labor-price:request:r1"), price);
  assert.equal(f.events[0].actorId, "manager1");
  assert.match(f.events[0].description, /999/);
  f.settings.set("cutting:labor-price:v1", { sheetRate: 900, edgeRate: 90 });
  assert.deepEqual(await f.pricing.readCuttingPrice(f.db, "r1"), price);
});
test("unconfigured or incomplete requests do not save a snapshot or replace old totals", async () => {
  const f = fixture();
  f.request.cuttingEdgeMeters = null;
  await assert.rejects(f.pricing.repriceCuttingRequest("r1", "m"), /метраж/);
  assert.equal(f.request.quotedTotal, 999);
  assert.equal(f.settings.has("cutting:labor-price:request:r1"), false);
  f.settings.clear();
  await assert.rejects(f.pricing.repriceCuttingRequest("r1", "m"), /прайс/);
});
test("saving a production comment cannot overwrite an automatic amount", async () => {
  const f = fixture();
  await f.pricing.repriceCuttingRequest("r1", "m");
  const production = loadAction("../lib/server/request-production.ts", {
    "@/generated/prisma": {},
    "@/lib/db": { getDb: () => f.db, hasDatabaseUrl: () => true },
    "@/lib/server/request-inbox": {},
    "@/lib/server/cutting-pricing": f.pricing,
  });
  await production.updateRequestProductionResult({
    requestId: "r1",
    quotedTotal: 1,
    productionComment: "Ready",
  });
  assert.equal(f.request.quotedTotal, 1513);
  assert.equal(f.request.productionComment, "Ready");
});

test("quantity edits use frozen rates; legacy totals remain unchanged", async () => {
  const f = fixture();
  const inbox = loadAction("../lib/server/request-inbox.ts", {
    "node:fs/promises": {},
    "node:path": { default: path },
    "@/generated/prisma": {},
    "@/lib/auth/demo-access": {},
    "@/lib/db": { getDb: () => f.db, hasDatabaseUrl: () => true },
    "@/features/cutting/labor-price": pure,
    "@/lib/server/cutting-pricing": f.pricing,
  });
  await inbox.updateRequestCuttingDetails({
    id: "r1",
    material: "MDF",
    cuttingSheetCount: 2,
    cuttingEdgeMeters: 10,
    edgeOption: "ABS",
  });
  assert.equal(f.request.quotedTotal, 999);
  await f.pricing.repriceCuttingRequest("r1", "m");
  f.settings.set("cutting:labor-price:v1", { sheetRate: 900, edgeRate: 90 });
  await inbox.updateRequestCuttingDetails({
    id: "r1",
    material: "MDF",
    cuttingSheetCount: 3,
    cuttingEdgeMeters: 10,
    edgeOption: "ABS",
  });
  assert.equal(f.request.quotedTotal, 1150);
  await inbox.updateRequestCuttingDetails({
    id: "r1",
    material: "MDF",
    cuttingSheetCount: null,
    cuttingEdgeMeters: 10,
    edgeOption: "ABS",
  });
  assert.equal(f.request.quotedTotal, null);
});

test("new requests save the configured labor price and snapshot together", async () => {
  const f = fixture();
  let transactions = 0;
  const baseTransaction = f.db.$transaction;
  f.db.$transaction = async (fn) => { transactions++; return baseTransaction(fn); };
  f.db.request.findMany = async () => [];
  f.db.request.create = async ({ data }) => { Object.assign(f.request, data); return { id: "r1", number: data.number }; };
  const inbox = loadAction("../lib/server/request-inbox.ts", {
    "node:fs/promises": {}, "node:path": { default: path },
    "@/generated/prisma": { RequestType: { CUTTING_SERVICE: "CUTTING_SERVICE" }, RequestStatus: { NEW: "NEW" }, MessengerType: {} },
    "@/lib/auth/demo-access": {},
    "@/lib/db": { getDb: () => f.db, hasDatabaseUrl: () => true },
    "@/features/cutting/labor-price": pure, "@/lib/server/cutting-pricing": f.pricing,
  });
  const input = { subject: "Cutting", message: "", contactName: "Client", contactPhone: "12345678", material: "MDF", cuttingSheetCount: 2, cuttingEdgeMeters: 10, edgeOption: "ABS", estimatedBudget: null };
  await inbox.createCuttingRequest(input, { skipDuplicateCheck: true });
  assert.equal(transactions, 1);
  assert.equal(f.request.quotedTotal, 850);
  assert.deepEqual(f.settings.get("cutting:labor-price:request:r1"), price);
  f.settings.clear();
  await inbox.createCuttingRequest(input, { skipDuplicateCheck: true });
  assert.equal(f.request.quotedTotal, null);
  assert.equal(f.settings.size, 0);
});

test("server actions enforce admin-only price edits and deny unauthorized recalculation", async () => {
  const enumRole = { ADMIN: "ADMIN", SUPER_ADMIN: "SUPER_ADMIN" };
  let actor = { roleCode: "CUTTING_MANAGER", userId: "m" };
  let writes = 0;
  const actions = loadAction("../app/admin/cutting/pricing/actions.ts", {
    "next/navigation": {
      redirect: (url) => {
        throw new Error(`redirect:${url}`);
      },
    },
    "next/cache": { revalidatePath: () => {} },
    "@/generated/prisma": {
      RoleCode: enumRole,
      RequestType: { CUTTING_SERVICE: "CUTTING_SERVICE" },
    },
    "@/lib/auth/dal": { requireAdminSession: async () => actor },
    "@/lib/auth/roles": { canAccessRequestType: (role) => role !== "CUSTOMER" },
    "@/lib/db": {
      hasDatabaseUrl: () => true,
      getDb: () => ({
        siteSetting: {
          upsert: async () => {
            writes++;
          },
        },
      }),
    },
    "@/features/cutting/labor-price": pure,
    "@/features/cutting/site-prices": sitePrices,
    "@/lib/server/cutting-pricing": {
      cuttingPriceKey: "price",
      siteCuttingPricesKey: "site",
      repriceCuttingRequest: async () => {
        writes++;
      },
    },
  });
  const form = new FormData();
  form.set("sheetRate", "300");
  form.set("edgeRate", "25");
  form.set("requestId", "r1");
  await assert.rejects(actions.saveCuttingPriceAction(form), /администратор/);
  assert.equal(writes, 0);
  actor = { roleCode: "CUSTOMER", userId: "c" };
  await assert.rejects(
    actions.repriceCuttingRequestAction(form),
    /Нет доступа/,
  );
  assert.equal(writes, 0);
  actor = { roleCode: "ADMIN", userId: "a" };
  await assert.rejects(actions.saveCuttingPriceAction(form), /saved=1/);
  assert.equal(writes, 1);
});

test("site prices: admin edits reach the calculator, broken values keep defaults", async () => {
  const { parseSiteCuttingPrices, defaultSiteCuttingPrices, buildCuttingSiteIncentive } =
    sitePrices;
  assert.deepEqual(parseSiteCuttingPrices(null), defaultSiteCuttingPrices);
  const parsed = parseSiteCuttingPrices({
    sheet: 320,
    sheetRegular: "350",
    edge: -1,
    drilling: { 5: 7, 8: 12.5, 12: 99 },
  });
  assert.equal(parsed.sheet, 320);
  assert.equal(parsed.sheetRegular, 350);
  assert.equal(parsed.edge, 28);
  assert.equal(parsed.drilling[5], 7);
  assert.equal(parsed.drilling[8], 12.5);
  assert.equal(parsed.drilling[12], undefined);
  const incentive = buildCuttingSiteIncentive(parsed);
  assert.equal(incentive.badge, "−30 сом");
  assert.match(incentive.title, /распил 320 сом за лист вместо 350/);
  assert.equal(incentive.offers[0].now, "320");
  assert.equal(
    buildCuttingSiteIncentive({ ...parsed, sheet: 350, edge: 35 }),
    null,
  );

  let saved;
  let actor = { roleCode: "CUTTING_MANAGER", userId: "m" };
  const actions = loadAction("../app/admin/cutting/pricing/actions.ts", {
    "next/navigation": {
      redirect: (url) => {
        throw new Error(`redirect:${url}`);
      },
    },
    "next/cache": { revalidatePath: () => {} },
    "@/generated/prisma": {
      RoleCode: { ADMIN: "ADMIN", SUPER_ADMIN: "SUPER_ADMIN" },
      RequestType: {},
    },
    "@/lib/auth/dal": { requireAdminSession: async () => actor },
    "@/lib/auth/roles": {},
    "@/lib/db": {
      hasDatabaseUrl: () => true,
      getDb: () => ({
        siteSetting: { upsert: async ({ update }) => (saved = update.value) },
      }),
    },
    "@/features/cutting/labor-price": pure,
    "@/features/cutting/site-prices": sitePrices,
    "@/lib/server/cutting-pricing": { siteCuttingPricesKey: "site" },
  });
  const form = new FormData();
  form.set("siteSheet", "320");
  form.set("siteSheetRegular", "350");
  form.set("siteEdge", "25,5");
  form.set("siteEdgeRegular", "35");
  for (const diameter of sitePrices.drillingDiameters)
    form.set(`drill${diameter}`, String(diameter));
  await assert.rejects(actions.saveSiteCuttingPricesAction(form), /администратор/);
  assert.equal(saved, undefined);
  actor = { roleCode: "ADMIN", userId: "a" };
  form.set("drill35", "");
  await assert.rejects(actions.saveSiteCuttingPricesAction(form), /siteError/);
  assert.equal(saved, undefined);
  form.set("drill35", "40");
  await assert.rejects(actions.saveSiteCuttingPricesAction(form), /siteSaved=1/);
  assert.equal(saved.sheet, 320);
  assert.equal(saved.edge, 25.5);
  assert.equal(saved.drilling[35], 40);
  assert.equal(saved.drilling[5], 5);
});

test("conversion carries the saved labor amount into the order, including zero", async () => {
  let saved;
  const orders = loadAction("../lib/server/order-inbox.ts", {
    "node:fs/promises": {}, "node:path": { default: path },
    "@/generated/prisma": { OrderStatus: { NEW: "NEW" } },
    "@/lib/auth/demo-access": {},
    "@/lib/db": { hasDatabaseUrl: () => true, getDb: () => ({ order: { create: async (input) => { saved = input.data; return { id: "o1" }; } } }) },
    "@/lib/server/inventory-reservations": {}, "@/lib/server/order-loyalty-cancellation": {},
  });
  const request = { id: "r1", type: "CUTTING_SERVICE", number: "R1", subject: "Cutting", material: "MDF", message: "", contactName: "Client", contactPhone: "123", files: [], estimatedBudget: 999, quotedTotal: 850 };
  await orders.createOrderFromRequest(request);
  assert.equal(saved.total, 850);
  assert.equal(saved.items.create[0].unitPrice, 850);
  await orders.createOrderFromRequest({ ...request, quotedTotal: 0 });
  assert.equal(saved.total, 0);
  await orders.createOrderFromRequest({ ...request, type: "CONTACT" });
  assert.equal(saved.total, 999);
});

test("cutting report totals exclude canceled requests and preserve item amounts", async () => {
  const statuses = Object.fromEntries(
    [
      "NEW",
      "RESERVED",
      "CONFIRMED",
      "PAID",
      "IN_PRODUCTION",
      "READY_FOR_PICKUP",
      "SHIPPED",
      "COMPLETED",
      "CANCELED",
      "IN_REVIEW",
      "QUOTE_SENT",
      "WAITING_FOR_CLIENT",
      "IN_PROGRESS",
    ].map((key) => [key, key]),
  );
  const requests = [
    { id: "a", status: "COMPLETED", quotedTotal: 1200 },
    { id: "b", status: "CANCELED", quotedTotal: 900 },
    { id: "c", status: "NEW", quotedTotal: null },
    { id: "d", status: "NEW", quotedTotal: 0 },
  ].map((r) => ({
    ...r,
    type: "CUTTING_SERVICE",
    contactName: "Client",
    material: "MDF",
    cuttingSheetCount: 1,
    cuttingEdgeMeters: 0,
    edgeOption: null,
    cuttingStage: null,
    message: "",
    createdAt: new Date(),
  }));
  const db = {
    request: { findMany: async () => requests },
    order: {
      findMany: async () => [],
      aggregate: async () => ({ _sum: { total: 0 }, _count: { _all: 0 } }),
    },
    user: { count: async () => 0, aggregate: async () => ({ _sum: {} }) },
  };
  const reports = loadAction("../lib/server/admin-data.ts", {
    "@/generated/prisma": {
      OrderStatus: statuses,
      RequestStatus: statuses,
      CategoryKind: {},
      CuttingStage: {},
      ProductStatus: {},
      PromotionStatus: {},
      RequestType: { CUTTING_SERVICE: "CUTTING_SERVICE" },
    },
    "@/lib/db": { getDb: () => db, hasDatabaseUrl: () => true },
    "@/lib/server/order-inbox": {},
    "@/lib/server/request-inbox": {},
  });
  const report = await reports.getAdminExecutiveReport("month");
  assert.equal(report.cuttingReport.totalAmount, 1200);
  assert.equal(report.cuttingReport.amountSpecified, 2);
  assert.equal(
    report.cuttingReport.items.find((r) => r.id === "b").quotedTotal,
    900,
  );
});
