import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCuttingQuote,
  cuttingExtrasFromForm,
  parseCuttingExtras,
  parseCuttingExtrasPrice,
} from "../features/cutting/quote";
import { parseSiteCuttingPrices } from "../features/cutting/site-prices";

const price = {
  sheetRate: 300,
  edgeRate: 28,
  ...parseCuttingExtrasPrice({
    drilling: {},
    milling: 200,
    bevel: 250,
    groove: 200,
    hdfSheet: 100,
    hplSheet: 400,
    countertopCut: 100,
    countertopEdge: 250,
  }),
};

test("ХДФ, HPL and countertop works get their own lines", () => {
  const extras = parseCuttingExtras({
    drilling: {},
    curveMeters: 0,
    bevelMeters: 0,
    hdfSheets: 3,
    hplSheets: 1,
    countertopCutMeters: 2.5,
    countertopEdgeMeters: 4,
    source: "manager",
  });
  const quote = buildCuttingQuote(price, { cuttingSheetCount: 2 }, extras)!;
  assert.deepEqual(
    quote.lines.map((line) => [line.key, line.amount]),
    [
      ["sheets", 600],
      ["hdfSheets", 300],
      ["hplSheets", 400],
      ["countertopCutMeters", 250],
      ["countertopEdgeMeters", 1000],
    ],
  );
  assert.equal(quote.total, 2550);
});

test("countertop-only order is priced without ЛДСП sheets", () => {
  const form = new FormData();
  form.set("countertopCutMeters", "3,2");
  form.set("countertopEdgeMeters", "1,5");
  const parsed = cuttingExtrasFromForm(form);
  assert.ok(parsed.ok);
  const quote = buildCuttingQuote(
    price,
    { cuttingSheetCount: null },
    parsed.ok ? parsed.extras : null,
  )!;
  assert.deepEqual(
    quote.lines.map((line) => line.key),
    ["countertopCutMeters", "countertopEdgeMeters"],
  );
  assert.equal(quote.total, 695);
  // Без листов и без других материалов счёта нет, как раньше.
  assert.equal(
    buildCuttingQuote(price, { cuttingSheetCount: null }, null),
    null,
  );
});

test("bad sheet counts are rejected, old prices get defaults", () => {
  const form = new FormData();
  form.set("hdfSheets", "1,5");
  assert.equal(cuttingExtrasFromForm(form).ok, false);
  const old = parseSiteCuttingPrices({ sheet: 300 });
  assert.equal(old.hdfSheet, 100);
  assert.equal(old.countertopCut, 100);
  assert.equal(parseCuttingExtrasPrice({ drilling: {} }).hdfSheet, 100);
});
