import assert from "node:assert/strict";
import test from "node:test";
import { getQuickPurchaseLimit } from "../features/storefront/quick-purchase-state";
import { appendCartItem } from "../features/cart/state";

test("quick purchase subtracts units already in the cart", () => {
  assert.equal(getQuickPurchaseLimit(25, true, 5), 20);
  assert.equal(getQuickPurchaseLimit(2, true, 2), 0);
  assert.equal(getQuickPurchaseLimit(2, true, 5), 0);
});

test("unavailable stock cannot be added", () => {
  assert.equal(getQuickPurchaseLimit(0, true, 0), 0);
  assert.equal(getQuickPurchaseLimit(null, false, 0), 0);
  assert.equal(getQuickPurchaseLimit(20, false, 0), 0);
  assert.equal(getQuickPurchaseLimit(NaN, true, 0), 0);
  assert.equal(getQuickPurchaseLimit(-3, true, 0), 0);
});

test("unknown stock keeps the existing per-item ceiling", () => {
  assert.equal(getQuickPurchaseLimit(null, true, 900), 99);
  assert.equal(getQuickPurchaseLimit(5000, true, 900), 99);
  assert.equal(getQuickPurchaseLimit(10.5, true, 2), 8);
});

test("fresh lower stock rejects a previously valid quick purchase", () => {
  const items = [{ productSlug: "hinge", quantity: 3 }];
  assert.equal(getQuickPurchaseLimit(25, true, 3), 22);
  assert.equal(appendCartItem(items, "hinge", 20, 5), null);
  assert.equal(getQuickPurchaseLimit(5, true, 3), 2);
  assert.deepEqual(appendCartItem(items, "hinge", 2, 5), [
    { productSlug: "hinge", quantity: 5 },
  ]);
});
