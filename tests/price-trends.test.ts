import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPriceTrendReport,
  getPriceTrendMonthKey,
  listPriceTrendMonths,
  type PriceTrendLine,
} from "../features/admin/price-trends";

const line = (
  productKey: string,
  unitPrice: number,
  soldAt: string,
  quantity = 1,
): PriceTrendLine => ({
  productKey,
  name: productKey,
  sku: null,
  unitPrice,
  quantity,
  soldAt: new Date(soldAt),
});

test("month list goes back across the year boundary", () => {
  assert.deepEqual(listPriceTrendMonths("2026-02", 4), [
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
  ]);
});

test("month key uses Bishkek time", () => {
  // 31 октября 20:00 UTC = 1 ноября 02:00 в Бишкеке.
  assert.equal(
    getPriceTrendMonthKey(new Date("2026-10-31T20:00:00Z")),
    "2026-11",
  );
});

test("each product is compared with its own first price", () => {
  const months = listPriceTrendMonths("2026-03", 3);
  const report = buildPriceTrendReport(
    [
      line("white", 4000, "2026-01-10T06:00:00Z", 10),
      line("white", 4400, "2026-03-10T06:00:00Z", 10),
      line("oak", 6000, "2026-01-12T06:00:00Z", 10),
      line("oak", 6000, "2026-02-12T06:00:00Z", 10),
      // Продан один раз — в сравнение не попадает.
      line("once", 9000, "2026-03-01T06:00:00Z"),
      // Вне периода.
      line("white", 1000, "2025-06-01T06:00:00Z"),
    ],
    months,
  );

  assert.equal(report.totalLines, 5);
  assert.equal(report.products.length, 2);
  assert.equal(report.products[0].productKey, "white");
  assert.equal(report.products[0].changePercent, 10);
  assert.equal(report.products[1].changePercent, 0);
  // Март: white +10%, oak в марте не продавался → цепочка 100 → 100 → 110.
  assert.equal(report.overallChangePercent, 10);
  assert.deepEqual(
    report.months.map((month) => month.index),
    [100, 100, 110],
  );
  assert.equal(report.months[2].lines, 2);
});

test("monthly price is weighted by quantity", () => {
  const report = buildPriceTrendReport(
    [
      line("a", 100, "2026-01-05T06:00:00Z"),
      line("a", 200, "2026-02-05T06:00:00Z", 3),
      line("a", 100, "2026-02-06T06:00:00Z", 1),
    ],
    listPriceTrendMonths("2026-02", 2),
  );

  assert.equal(report.products[0].lastPrice, 175);
  assert.equal(report.products[0].changePercent, 75);
});

test("assortment changes do not move the index", () => {
  // A: 100 в январе, 200 в феврале и марте; B: 100 в марте и апреле.
  const report = buildPriceTrendReport(
    [
      line("a", 100, "2026-01-05T06:00:00Z"),
      line("a", 200, "2026-02-05T06:00:00Z"),
      line("a", 200, "2026-03-05T06:00:00Z"),
      line("b", 100, "2026-03-06T06:00:00Z"),
      line("b", 100, "2026-04-06T06:00:00Z"),
    ],
    listPriceTrendMonths("2026-04", 4),
  );

  assert.deepEqual(
    report.months.map((month) => month.index),
    [100, 200, 200, 200],
  );
  assert.equal(report.overallChangePercent, 100);
});
