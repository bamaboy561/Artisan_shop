import assert from "node:assert/strict";
import test from "node:test";
import {
  appendCartItem,
  MAX_CART_ITEM_QUANTITY,
  parseCart,
} from "../features/cart/state";

test("restores the existing cart storage format", () => {
  assert.deepEqual(parseCart('[{"productSlug":"hinge","quantity":2}]'), [
    { productSlug: "hinge", quantity: 2 },
  ]);
});

test("ignores invalid storage and invalid items", () => {
  for (const input of [null, "broken", "{}", "null"])
    assert.deepEqual(parseCart(input), []);
  assert.deepEqual(
    parseCart(
      '[null,{}, {"productSlug":"","quantity":2},{"productSlug":"a","quantity":"2"},{"productSlug":"a","quantity":-1}]',
    ),
    [],
  );
});

test("merges duplicates, floors quantities and caps restored items", () => {
  assert.deepEqual(
    parseCart(
      '[{"productSlug":"a","quantity":1.5},{"productSlug":"a","quantity":2},{"productSlug":"b","quantity":10000}]',
    ),
    [
      { productSlug: "a", quantity: 3 },
      { productSlug: "b", quantity: MAX_CART_ITEM_QUANTITY },
    ],
  );
});

test("does not allow buying twenty when only two are in stock", () => {
  assert.equal(appendCartItem([], "hinge", 20, 2), null);
  assert.deepEqual(appendCartItem([], "hinge", 2, 2), [
    { productSlug: "hinge", quantity: 2 },
  ]);
});

test("checks the latest cart for sequential async completions", () => {
  const first = appendCartItem([], "hinge", 1, 2)!;
  const second = appendCartItem(first, "hinge", 1, 2)!;
  assert.equal(appendCartItem(second, "hinge", 1, 2), null);
  assert.equal(second[0].quantity, 2);
  assert.equal(first[0].quantity, 1);
});

test("rejects invalid increments and sold-out products", () => {
  for (const quantity of [NaN, Infinity, -1, 0])
    assert.equal(appendCartItem([], "a", quantity, 2), null);
  assert.equal(appendCartItem([], "a", 1, 0), null);
  assert.equal(appendCartItem([], "a", 1000, null), null);
  assert.deepEqual(appendCartItem([], "a", 1, null), [
    { productSlug: "a", quantity: 1 },
  ]);
});
