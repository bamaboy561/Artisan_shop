import assert from "node:assert/strict";
import test from "node:test";

import {
  edgeSizeFromName,
  parseMaterialLines,
  sheetThicknessFromName,
  summarizeMaterialLines,
} from "../features/cutting/material-lines";

test("parses stock and client lines, skips empty rows", () => {
  const parsed = parseMaterialLines(
    JSON.stringify([
      {
        kind: "SHEET",
        source: "STOCK",
        productId: "p1",
        name: "ЛДСП Кашемир 16 мм",
        sku: "U702",
        thicknessMm: "16",
        format: "2800×2070",
        quantity: "4",
      },
      { kind: "SHEET", source: "STOCK", productId: null, name: "" },
      {
        kind: "SHEET",
        source: "CLIENT",
        name: "МДФ клиента",
        thicknessMm: "18",
        quantity: "2",
      },
      {
        kind: "EDGE",
        source: "CLIENT",
        name: "Белая 101",
        thicknessMm: "0,8",
        widthMm: "22",
        quantity: "48,5",
      },
      { kind: "EDGE", source: "CLIENT", name: "", quantity: "" },
    ]),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.lines.length, 3);
  assert.equal(parsed.lines[2].thicknessMm, 0.8);
  assert.equal(parsed.lines[2].quantity, 48.5);
  assert.equal(parsed.lines[1].productId, null);

  const summary = summarizeMaterialLines(parsed.lines);
  assert.equal(summary.sheetCount, 6);
  assert.equal(summary.edgeMeters, 48.5);
  assert.equal(
    summary.material,
    "ЛДСП Кашемир 16 мм, 2800×2070 — 4 шт.; МДФ клиента, 18 мм — 2 шт. (привозной)",
  );
  assert.equal(summary.edgeOption, "Белая 101, 0,8×22 мм — 48,5 м (привозной)");
});

test("client line with size but no name is an error", () => {
  const parsed = parseMaterialLines(
    JSON.stringify([{ kind: "SHEET", source: "CLIENT", quantity: "3" }]),
  );
  assert.equal(parsed.ok, false);
});

test("stock line typed but not picked is an error", () => {
  const parsed = parseMaterialLines(
    JSON.stringify([{ kind: "EDGE", source: "STOCK", name: "Кромка" }]),
  );
  assert.equal(parsed.ok, false);
});

test("bad quantity is an error, no lines gives empty summary", () => {
  assert.equal(
    parseMaterialLines(
      JSON.stringify([
        { kind: "SHEET", source: "CLIENT", name: "Лист", quantity: "abc" },
      ]),
    ).ok,
    false,
  );
  assert.deepEqual(summarizeMaterialLines([]), {
    material: null,
    edgeOption: null,
    sheetCount: null,
    edgeMeters: null,
  });
  assert.deepEqual(parseMaterialLines(""), { ok: true, lines: [] });
});

test("edge and sheet sizes from product names", () => {
  assert.deepEqual(edgeSizeFromName("Кромка Серый Кварцит 1*19 мм"), {
    thicknessMm: 1,
    widthMm: 19,
  });
  assert.deepEqual(edgeSizeFromName("Кромка ПВХ Кашемир шагрень 19/1"), {
    thicknessMm: 1,
    widthMm: 19,
  });
  assert.deepEqual(edgeSizeFromName("S-119-ABS-Светло-бежевый/VL/22/1.0"), {
    thicknessMm: 1,
    widthMm: 22,
  });
  assert.equal(edgeSizeFromName("Кромка белая"), null);
  assert.equal(sheetThicknessFromName("ЛДСП 16 мм Кашемир"), 16);
  assert.equal(sheetThicknessFromName("МДФ 18мм"), 18);
  assert.equal(sheetThicknessFromName("Кашемир U6933 VL"), null);
});

test("ХДФ, HPL and столешница rows are not counted as ЛДСП sheets", () => {
  const parsed = parseMaterialLines(
    JSON.stringify([
      { kind: "SHEET", source: "CLIENT", name: "ЛДСП белая", quantity: "4" },
      {
        kind: "SHEET",
        source: "CLIENT",
        name: "ХДФ белый",
        thicknessMm: "3",
        quantity: "2",
      },
      {
        kind: "SHEET",
        source: "CLIENT",
        name: "Задняя стенка",
        thicknessMm: "3",
        quantity: "1",
      },
      {
        kind: "SHEET",
        source: "CLIENT",
        name: "Столешница 38 мм",
        quantity: "1",
      },
    ]),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(summarizeMaterialLines(parsed.lines).sheetCount, 4);
});
