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
    hplCut: 500,
    sinkCut: 1500,
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
    hplCutMeters: 1.2,
    sinkCutMeters: 2.1,
    golaCMeters: 3,
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
      ["hplCutMeters", 600],
      ["countertopCutMeters", 250],
      ["sinkCutMeters", 3150],
      ["countertopEdgeMeters", 1000],
      ["golaCMeters", 210],
    ],
  );
  assert.equal(quote.total, 6110);
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
  assert.equal(old.hplCut, 500);
  assert.equal(old.sinkCut, 1500);
  assert.equal(old.countertopEdge, 60);
  assert.equal(old.golaL, 50);
  assert.equal(parseCuttingExtrasPrice({ drilling: {} }).hdfSheet, 100);
});

test("materials typed by hand keep drilling from the Bazis project", async () => {
  const { mergeMaterialWork, hasMachiningExtras } =
    await import("../features/cutting/quote");
  const bazis = parseCuttingExtras({
    drilling: { 5: 40 },
    curveMeters: 0,
    bevelMeters: 0,
    source: "bazis",
  });
  const typed = parseCuttingExtras({
    drilling: {},
    curveMeters: 0,
    bevelMeters: 0,
    hdfSheets: 2,
    source: "manager",
  });
  assert.equal(hasMachiningExtras(typed), false);
  const merged = mergeMaterialWork(bazis, typed)!;
  assert.deepEqual(merged.drilling, { "5": 40 });
  assert.equal(merged.hdfSheets, 2);
  assert.equal(merged.source, "bazis");
  assert.equal(mergeMaterialWork(null, typed)?.hdfSheets, 2);
});
