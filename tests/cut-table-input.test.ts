import assert from "node:assert/strict";
import test from "node:test";

import {
  edgesFromKey,
  gridCellValue,
  isNumberGrid,
  nextColumn,
  parsePastedGrid,
  sanitizeNumberInput,
} from "../features/services/cut-table-input";

test("Enter идёт по полям детали, после кромки — на следующую деталь", () => {
  assert.equal(nextColumn("title"), "width");
  assert.equal(nextColumn("width"), "height");
  assert.equal(nextColumn("quantity"), "edge");
  assert.equal(nextColumn("edge"), null);
});

test("в числовом поле только цифры, запятая становится точкой", () => {
  assert.equal(sanitizeNumberInput("720"), "720");
  assert.equal(sanitizeNumberInput("720,5"), "720.5");
  assert.equal(sanitizeNumberInput("7 2 0мм"), "720");
  assert.equal(sanitizeNumberInput("1.2.3"), "1.23");
});

test("кромка с клавиатуры в любой раскладке", () => {
  assert.deepEqual(edgesFromKey("KeyR", []), [
    "top",
    "right",
    "bottom",
    "left",
  ]);
  assert.deepEqual(edgesFromKey("Digit0", ["top", "left"]), []);
  assert.deepEqual(edgesFromKey("KeyL", []), ["top", "bottom"]);
  assert.deepEqual(edgesFromKey("KeyL", ["top", "right", "bottom"]), ["right"]);
  assert.deepEqual(edgesFromKey("KeyI", ["top"]), ["top", "right", "left"]);
  assert.deepEqual(
    edgesFromKey("Space", ["top", "right", "bottom", "left"]),
    [],
  );
  assert.equal(edgesFromKey("KeyQ", []), null);
});

test("вставка из Excel: таблица чисел заполняет колонки", () => {
  assert.equal(parsePastedGrid("720"), null);
  assert.equal(parsePastedGrid("720\n"), null);
  const grid = parsePastedGrid("720\t560\t2\r\n564\t540\t3\r\n");
  assert.deepEqual(grid, [
    ["720", "560", "2"],
    ["564", "540", "3"],
  ]);
  assert.equal(isNumberGrid(grid!, "width"), true);
  // С колонки «Ширина» вправо помещаются только две колонки.
  assert.equal(isNumberGrid(grid!, "height"), false);
  assert.equal(isNumberGrid([["Боковина", "720"]], "width"), false);
  assert.equal(isNumberGrid([["720"], ["564"]], "quantity"), true);
  assert.equal(gridCellValue("720 мм"), "720");
  assert.equal(gridCellValue("720,5"), "720.5");
  assert.equal(gridCellValue("72,3 см"), "723");
  assert.equal(gridCellValue("2,6", "quantity"), "3");
  assert.equal(gridCellValue(""), null);
});
