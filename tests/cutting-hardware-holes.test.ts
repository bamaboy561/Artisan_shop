import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCuttingQuote,
  cuttingExtrasFromForm,
  parseCuttingExtras,
  parseCuttingExtrasPrice,
} from "../features/cutting/quote";
import { defaultSiteCuttingPrices } from "../features/cutting/site-prices";
import { priceDrilling } from "../lib/drilling-price";
import {
  createHardware,
  hardwareHoles,
  hardwareWorkHoles,
  holesToDrillCounts,
} from "../features/services/drilling-hardware";

test("price list defaults for hardware holes", () => {
  const p = defaultSiteCuttingPrices;
  assert.deepEqual(
    [p.minifix, p.confirmat, p.dowel, p.rafix, p.tofik, p.mark],
    [25, 14, 14, 28, 33, 3],
  );
});

test("calculator: minifix body is 25 per hole, its stem hole by diameter", () => {
  const items = [createHardware("minifix", "left")];
  const holes = hardwareHoles(items, 600, 400, 16);
  const work = hardwareWorkHoles(items, 600, 400, 16);
  assert.deepEqual(work, [{ key: "minifixHoles", diameter: 15, holes: 2 }]);
  const result = priceDrilling(
    [{ drill: holesToDrillCounts(holes), work, quantity: 2 }],
    defaultSiteCuttingPrices.drilling,
    defaultSiteCuttingPrices,
  );
  // 4 корпуса × 25 + 4 отверстия Ø8 × 10.
  assert.equal(result.holes, 8);
  assert.equal(result.cost, 4 * 25 + 4 * 10);
  assert.deepEqual(
    result.rows.map((row) => [row.diameter, row.holes]),
    [[8, 4]],
  );
  assert.deepEqual(
    result.workRows.map((row) => [row.key, row.holes]),
    [["minifixHoles", 4]],
  );
});

test("calculator: confirmat and dowel edge holes are 14 each", () => {
  const items = [
    createHardware("confirmatEdge", "top"),
    createHardware("dowelEdge", "bottom"),
  ];
  const holes = hardwareHoles(items, 600, 400, 16);
  const result = priceDrilling(
    [
      {
        drill: holesToDrillCounts(holes),
        work: hardwareWorkHoles(items, 600, 400, 16),
      },
    ],
    defaultSiteCuttingPrices.drilling,
    defaultSiteCuttingPrices,
  );
  assert.equal(result.rows.length, 0);
  assert.equal(result.cost, 4 * 14);
});

test("quote: hardware holes are lines after drilling, and count as machining", () => {
  const price = {
    sheetRate: 300,
    edgeRate: 28,
    ...parseCuttingExtrasPrice({}),
  };
  const extras = parseCuttingExtras({
    drilling: { "8": 4 },
    curveMeters: 0,
    bevelMeters: 0,
    minifixHoles: 4,
    markHoles: 10,
    source: "calculator",
  })!;
  const quote = buildCuttingQuote(
    price,
    { cuttingSheetCount: 1, cuttingEdgeMeters: 0, edgeOption: null },
    extras,
  )!;
  assert.deepEqual(
    quote.lines.map((line) => [line.key, line.amount]),
    [
      ["sheets", 300],
      ["drill-8", 40],
      ["minifixHoles", 100],
      ["markHoles", 30],
    ],
  );
  assert.equal(quote.total, 470);
  assert.match(quote.lines[2].detail, /4 отверстия × 25 сом/);
});

test("manager form reads hardware holes as whole numbers", () => {
  const form = new FormData();
  form.set("confirmatHoles", "12");
  const parsed = cuttingExtrasFromForm(form);
  assert.ok(parsed.ok);
  assert.equal(parsed.ok && parsed.extras?.confirmatHoles, 12);
  const bad = new FormData();
  bad.set("tofikHoles", "1.5");
  const wrong = cuttingExtrasFromForm(bad);
  assert.equal(wrong.ok, false);
});
