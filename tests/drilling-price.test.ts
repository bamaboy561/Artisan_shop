import assert from "node:assert/strict";
import test from "node:test";

import { drillingHolePrice, priceDrilling } from "../lib/drilling-price";

test("hole prices follow the workshop price list", () => {
  assert.equal(drillingHolePrice(35), 32);
  assert.equal(drillingHolePrice(15), 13);
  assert.equal(drillingHolePrice(8), 10);
  assert.equal(drillingHolePrice(5.1), 6);
  assert.equal(drillingHolePrice(12), null);
});

test("holes are summed with quantities and priced", () => {
  const result = priceDrilling([
    { drill: { "35": 2, "5": 4 }, quantity: 3 },
    { drill: { "8": 1.5 }, quantity: 2 },
    { drill: { "12": 1 }, quantity: 1 },
  ]);
  assert.deepEqual(result.rows, [
    { diameter: 35, holes: 6, price: 32, cost: 192 },
    { diameter: 12, holes: 1, price: null, cost: 0 },
    { diameter: 8, holes: 3, price: 10, cost: 30 },
    { diameter: 5, holes: 12, price: 6, cost: 72 },
  ]);
  assert.equal(result.holes, 22);
  assert.equal(result.cost, 294);
  assert.equal(result.unpricedHoles, 1);
});
