import assert from "node:assert/strict";
import test from "node:test";

import { defaultSiteCuttingPrices } from "../features/cutting/site-prices";
import {
  addEstimates,
  estimateParts,
  formatSom,
} from "../features/constructor/estimate";
import {
  buildCabinet,
  CABINET_KINDS,
  type CabinetSpec,
} from "../features/services/cabinet-builder";

const wardrobe: CabinetSpec = {
  kind: "wardrobe",
  ...CABINET_KINDS.wardrobe.defaults,
};
const plate = { pricePerSqM: 500, sheetWidth: 2800, sheetHeight: 2070 };
const prices = defaultSiteCuttingPrices;

test("estimate prices sheets, cutting, edge and drilling like the calculator", () => {
  const parts = buildCabinet(wardrobe, 16).parts;
  const estimate = estimateParts(parts, 16, plate, prices)!;
  assert.ok(estimate.sheets >= 1);
  assert.ok(
    Math.abs(
      estimate.material - estimate.sheets * 2.8 * 2.07 * plate.pricePerSqM,
    ) < 1e-6,
  );
  assert.equal(estimate.cutting, estimate.sheets * prices.sheet);
  assert.ok(estimate.edgeMeters > 0);
  assert.ok(estimate.drilling > 0);
  assert.equal(
    estimate.total,
    estimate.material +
      estimate.cutting +
      estimate.edge +
      estimate.drilling +
      estimate.milling,
  );
});

test("no plate price — no estimate instead of a price that is too low", () => {
  const parts = buildCabinet(wardrobe, 16).parts;
  assert.equal(
    estimateParts(parts, 16, { ...plate, pricePerSqM: 0 }, prices),
    null,
  );
  assert.equal(estimateParts(parts, 16, null, prices), null);
});

test("a wider wardrobe takes more sheets", () => {
  const small = estimateParts(
    buildCabinet(wardrobe, 16).parts,
    16,
    plate,
    prices,
  )!;
  const big = estimateParts(
    buildCabinet({ ...wardrobe, width: 2400, shelves: 8 }, 16).parts,
    16,
    plate,
    prices,
  )!;
  assert.ok(big.sheets > small.sheets);
  assert.ok(big.total > small.total);
});

test("body and facade estimates add up", () => {
  const parts = buildCabinet(wardrobe, 16).parts;
  const one = estimateParts(parts, 16, plate, prices)!;
  const sum = addEstimates(one, one)!;
  assert.equal(sum.total, one.total * 2);
  assert.equal(sum.sheets, one.sheets * 2);
  assert.equal(addEstimates(null, null), null);
});

test("price is rounded to 10 som", () => {
  assert.equal(formatSom(14523).replace(/\s/g, " "), "14 520 сом");
});
