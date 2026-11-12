import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCuttingQuote,
  cuttingExtrasFromForm,
  parseCuttingExtras,
  parseCuttingExtrasPrice,
} from "../features/cutting/quote";
import { parseSiteCuttingPrices } from "../features/cutting/site-prices";

test("groove metres get their own line in the quote", () => {
  const price = {
    sheetRate: 300,
    edgeRate: 28,
    ...parseCuttingExtrasPrice({
      drilling: {},
      milling: 200,
      bevel: 250,
      groove: 150,
    }),
  };
  const extras = parseCuttingExtras({
    drilling: {},
    curveMeters: 0,
    bevelMeters: 0,
    grooveMeters: 4.2,
    source: "calculator",
  });
  const quote = buildCuttingQuote(price, { cuttingSheetCount: 1 }, extras)!;
  const line = quote.lines.find((item) => item.key === "groove")!;
  assert.equal(line.label, "Паз в пласти");
  assert.equal(line.amount, 630);
  assert.equal(quote.total, 930);
});

test("old saved prices and requests without grooves keep working", () => {
  assert.equal(parseSiteCuttingPrices({ milling: 180 }).groove, 200);
  assert.equal(parseCuttingExtrasPrice({ milling: 180 }).groove, 200);
  const old = parseCuttingExtras({
    drilling: { "5": 4 },
    curveMeters: 0,
    bevelMeters: 0,
  });
  assert.equal(old?.grooveMeters, undefined);
  const form = new FormData();
  form.set("grooveMeters", "2,5");
  const result = cuttingExtrasFromForm(form);
  assert.ok(result.ok);
  assert.equal(result.ok && result.extras?.grooveMeters, 2.5);
});
