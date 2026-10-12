import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import enums from "../generated/prisma/index.js";
import * as bundlePricing from "../features/catalog/bundle-pricing.ts";
import { getCustomerOrderWhere } from "../lib/server/customer-order-scope.ts";
import { loadAction } from "./load-action.mjs";

const pricing = loadAction("../lib/server/pricing.ts", {
  "@/generated/prisma": enums,
});
const promotionPricing = loadAction(
  "../lib/server/product-promotion-pricing.ts",
  { "@/lib/server/pricing": pricing },
);
class InventoryAvailabilityError extends Error {}
class InsufficientLoyaltyBalanceError extends Error {}

function checkoutFixture({
  signedIn = false,
  insufficientStock = false,
  promo = false,
} = {}) {
  const saved = [];
  const notices = [];
  const reservations = [];
  const ledger = [];
  const pending = [];
  const promotion = {
    id: "promo",
    name: "Sale",
    status: "ACTIVE",
    targetType: "ORDER",
    discountType: "PERCENT",
    discountValue: 10,
    startsAt: null,
    endsAt: null,
    promoCode: "TEN",
    usageLimit: null,
    usageCount: 0,
    minOrderTotal: null,
  };
  const product = {
    id: "p1",
    slug: "hinge",
    name: "Hinge",
    sku: "123",
    price: 1000,
    stockQuantity: 20,
    bundleItems: [],
    promotions: promo ? [{ promotion }] : [],
    category: { kind: "FITTINGS", promotions: [] },
    brand: { name: "Hettich" },
  };
  const user = signedIn
    ? {
        id: "customer",
        email: "customer@example.test",
        loyaltyTier: "SILVER",
        plateMaterialLoyaltyTier: "SILVER",
        fittingsLoyaltyTier: "SILVER",
        loyaltyPointsBalance: 2000,
        loyaltyPointsLifetime: 2000,
      }
    : null;
  const tx = {
    order: {
      create: async ({ data }) => {
        saved.push(data);
        return { id: "new-order", number: data.number };
      },
    },
    loyaltyTransaction: { create: async ({ data }) => pending.push(data) },
    promotion: {
      update: async () => ({}),
      updateMany: async () => ({ count: 1 }),
    },
  };
  const db = {
    product: { findMany: async () => [product] },
    user: { findUnique: async () => user },
    promotion: { findUnique: async () => promotion },
    $transaction: async (callback) => callback(tx),
  };
  const { submitCheckoutAction } = loadAction(
    "../app/(public)/checkout/actions.ts",
    {
      "next/cache": { revalidatePath: () => {} },
      zod: { z },
      "@/generated/prisma": enums,
      "@/features/catalog/bundle-pricing": bundlePricing,
      "@/lib/auth/dal": {
        getOptionalSession: async () =>
          signedIn ? { userId: "customer" } : null,
      },
      "@/lib/commerce": { formatPrice: String },
      "@/lib/db": { getDb: () => db, hasDatabaseUrl: () => true },
      "@/lib/server/commercial-integrations": {
        handleOrderCreated: async (data) => notices.push(data),
      },
      "@/lib/server/loyalty-settings": {
        getLoyaltyProgramConfig: async () =>
          pricing.defaultLoyaltyProgramConfig,
      },
      "@/lib/server/loyalty-ledger": {
        InsufficientLoyaltyBalanceError,
        applyApprovedLoyaltyDelta: async (client, data) => {
          assert.equal(client, tx);
          ledger.push(data);
          return { balanceAfter: 2000 + data.points };
        },
      },
      "@/lib/server/inventory-reservations": {
        InventoryAvailabilityError,
        reserveInventoryItems: async (client, lines, options) => {
          assert.equal(client, tx);
          reservations.push({ lines, options });
          if (insufficientStock)
            throw new InventoryAvailabilityError("Insufficient stock");
        },
      },
      "@/lib/server/operation-events": { logOperationEvent: async () => {} },
      "@/lib/server/product-promotion-pricing": promotionPricing,
      "@/lib/server/pricing": pricing,
    },
  );
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: "Client",
    phone: "+996555000000",
    comment: "Keep my comment",
    cartSnapshot: JSON.stringify([{ productSlug: "hinge", quantity: 2 }]),
  }))
    form.set(key, value);
  return {
    submitCheckoutAction,
    form,
    saved,
    notices,
    reservations,
    ledger,
    pending,
  };
}

test("guest checkout needs only name/phone and always saves pickup at zero cost", async () => {
  const f = checkoutFixture();
  f.form.set("deliveryMethodId", "old-paid-delivery");
  f.form.set("city", "Forged delivery city");
  const result = await f.submitCheckoutAction({}, f.form);
  assert.equal(result.success, true);
  assert.equal(f.saved[0].deliveryMethodId, null);
  assert.equal(f.saved[0].deliveryTotal, 0);
  assert.equal(f.saved[0].total, 2000);
  assert.equal(f.saved[0].comment, "Keep my comment");
  assert.equal(f.notices[0].comment, "Keep my comment");
  assert.equal(f.notices[0].deliveryMethod, "Самовывоз");
  assert.equal(f.reservations[0].options.requireOnlineAvailability, true);
});

test("insufficient inventory prevents saving and notifications", async () => {
  const f = checkoutFixture({ insufficientStock: true });
  assert.match(
    (await f.submitCheckoutAction({}, f.form)).message,
    /Insufficient stock/,
  );
  assert.equal(f.saved.length, 0);
  assert.equal(f.notices.length, 0);
});

test("validation identifies optional email errors without creating orders", async () => {
  const f = checkoutFixture();
  f.form.set("email", "bad-email");
  const result = await f.submitCheckoutAction({}, f.form);
  assert.ok(result.fieldErrors.email.length);
  assert.equal(f.saved.length, 0);
});

test("guest cannot spend another customer's bonuses", async () => {
  const f = checkoutFixture();
  f.form.set("redeemPoints", "50");
  const result = await f.submitCheckoutAction({}, f.form);
  assert.equal(result.success, undefined);
  assert.equal(f.saved.length, 0);
  assert.equal(f.ledger.length, 0);
});

test("product promotion, capped bonus spend and pending accrual are preserved", async () => {
  const f = checkoutFixture({ signedIn: true, promo: true });
  f.form.set("redeemPoints", "2000");
  const result = await f.submitCheckoutAction({}, f.form);
  assert.equal(result.success, true);
  assert.equal(f.saved[0].promotionDiscountTotal, 200);
  assert.equal(f.saved[0].loyaltyRedemptionTotal, 900);
  assert.equal(f.saved[0].total, 900);
  assert.equal(f.ledger[0].points, -900);
  assert.equal(f.ledger[0].requireSufficientBalance, true);
  assert.equal(f.pending[0].status, "PENDING");
  assert.equal(f.pending[0].points, 45);
  assert.equal(f.notices.length, 1);
});

function reorderFixture({
  session = { userId: "mine", email: "Owner@Example.test" },
  exists = true,
} = {}) {
  const queries = [];
  const slugQueries = [];
  const { prepareReorderAction } = loadAction(
    "../app/account/orders/actions.ts",
    {
      "@/lib/auth/dal": { getOptionalSession: async () => session },
      "@/lib/db": {
        hasDatabaseUrl: () => true,
        getDb: () => ({
          order: {
            findFirst: async (query) => {
              queries.push(query);
              return exists
                ? {
                    items: [
                      {
                        snapshotName: "Old hinge",
                        quantity: 2,
                        product: { slug: "hinge" },
                      },
                      {
                        snapshotName: "Deleted product",
                        quantity: 1,
                        product: null,
                      },
                    ],
                  }
                : null;
            },
          },
        }),
      },
      "@/lib/server/customer-order-scope": { getCustomerOrderWhere },
      "@/lib/server/catalog-public": {
        getPublicProductsBySlugs: async (slugs) => {
          slugQueries.push(slugs);
          return [
            {
              slug: "hinge",
              name: "New name",
              sku: "123",
              price: 242,
              stockQuantity: 5,
              inStock: true,
              purchaseMode: "cart",
              privateCost: 100,
            },
          ];
        },
      },
    },
  );
  return { prepareReorderAction, queries, slugQueries };
}

test("reorder requires login and validates identifiers before database access", async () => {
  const guest = reorderFixture({ session: null });
  assert.ok((await guest.prepareReorderAction("order")).error);
  assert.equal(guest.queries.length, 0);
  const user = reorderFixture();
  for (const invalid of ["", "a".repeat(201), null])
    assert.ok((await user.prepareReorderAction(invalid)).error);
  assert.equal(user.queries.length, 0);
});

test("reorder constrains the database query to this customer's visible orders", async () => {
  const f = reorderFixture();
  const result = await f.prepareReorderAction("order");
  assert.deepEqual(f.queries[0].where, {
    AND: [
      { id: "order" },
      {
        OR: [
          { userId: "mine" },
          {
            userId: null,
            contactEmail: { equals: "owner@example.test", mode: "insensitive" },
          },
        ],
      },
    ],
  });
  assert.deepEqual(f.slugQueries, [["hinge"]]);
  assert.equal(result.data.items[1].productSlug, null);
  assert.equal(result.data.products[0].price, 242);
  assert.equal(result.data.products[0].privateCost, undefined);
});

test("foreign or deleted orders reveal no contents and do not fetch products", async () => {
  const f = reorderFixture({ exists: false });
  const result = await f.prepareReorderAction("foreign-order");
  assert.ok(result.error);
  assert.equal(result.data, undefined);
  assert.equal(f.slugQueries.length, 0);
});
